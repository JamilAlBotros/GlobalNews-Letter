#!/usr/bin/env node

import { FeedHealthAnalyzer } from '../services/feed-health-analyzer.js';
import { HealthDatabaseManager } from '../database/health-schema.js';
import type { FeedHealthDashboard } from '../types/health.js';
import path from 'path';
import fs from 'fs';

/**
 * RSS Feed Health Monitoring CLI
 */

const DB_PATH = path.join(process.cwd(), 'data', 'rss-poller.db');

interface CliOptions {
  feedId?: string;
  days?: number;
  format?: 'table' | 'json' | 'summary';
  severity?: 'info' | 'warning' | 'error' | 'critical';
  resolve?: boolean;
  detailed?: boolean;
}

let analyzer: FeedHealthAnalyzer | null = null;
let dbManager: HealthDatabaseManager | null = null;

async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || 'help';

  if (command === 'help' || command === '--help' || command === '-h') {
    showHelp();
    return;
  }

  try {
    // Initialize services
    analyzer = new FeedHealthAnalyzer(DB_PATH);
    dbManager = new HealthDatabaseManager(DB_PATH);
    await dbManager.initializeHealthTables();

    // Parse options
    const options = parseOptions(args.slice(1));

    switch (command) {
      case 'check':
        await performHealthCheck(options);
        break;
        
      case 'summary':
        await showHealthSummary(options);
        break;
        
      case 'alerts':
        await showAlerts(options);
        break;
        
      case 'resolve':
        await resolveAlert(options);
        break;
        
      case 'volume':
        await analyzeVolume(options);
        break;
        
      case 'quality':
        await analyzeQuality(options);
        break;
        
      case 'credibility':
        await analyzeCredibility(options);
        break;
        
      case 'technical':
        await analyzeTechnical(options);
        break;
        
      case 'compare':
        await compareFeeds(options);
        break;
        
      case 'ranking':
        await rankFeeds(options);
        break;
        
      case 'outliers':
        await findOutliers(options);
        break;
        
      case 'monitor':
        await startMonitoring(options);
        break;
        
      case 'report':
        await generateReport(options);
        break;
        
      case 'dashboard':
        await showDashboard(options);
        break;
        
      default:
        console.error(`Unknown command: ${command}`);
        showHelp();
        process.exit(1);
    }
  } catch (error) {
    console.error('❌ Error:', error instanceof Error ? error.message : error);
    process.exit(1);
  } finally {
    if (analyzer) await analyzer.close();
    if (dbManager) await dbManager.close();
  }
}

function parseOptions(args: string[]): CliOptions {
  const options: CliOptions = { format: 'table', days: 7 };
  
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (!arg) continue;
    
    if (arg.startsWith('--feed=')) {
      const feedStr = arg.split('=')[1];
      if (feedStr) {
        options.feedId = feedStr;
      }
    } else if (arg.startsWith('--days=')) {
      const dayStr = arg.split('=')[1];
      if (dayStr) {
        options.days = parseInt(dayStr);
      }
    } else if (arg.startsWith('--format=')) {
      const formatStr = arg.split('=')[1];
      options.format = formatStr as any;
    } else if (arg.startsWith('--severity=')) {
      const severityStr = arg.split('=')[1];
      options.severity = severityStr as any;
    } else if (arg === '--resolve') {
      options.resolve = true;
    } else if (arg === '--detailed') {
      options.detailed = true;
    } else if (!arg.startsWith('-') && !options.feedId) {
      options.feedId = arg;
    }
  }
  
  return options;
}

async function performHealthCheck(options: CliOptions): Promise<void> {
  if (!options.feedId) {
    console.error('❌ Feed ID required for health check');
    console.log('Usage: npm run health check <feed-id>');
    return;
  }

  console.log(`🔍 Analyzing health for feed: ${options.feedId}`);
  console.log('⏳ This may take a moment...\n');

  const dashboard = await analyzer!.analyzeFeedHealth(options.feedId);
  
  if (options.format === 'json') {
    console.log(JSON.stringify(dashboard, null, 2));
    return;
  }

  await displayHealthDashboard(dashboard, options.detailed || false);
  
  // Save snapshot to database
  await dbManager!.saveHealthSnapshot(dashboard);
  
  // Save any new alerts
  for (const alert of dashboard.alerts) {
    await dbManager!.saveHealthAlert(alert);
  }
  
  console.log(`\n✅ Health check completed. Data saved to database.`);
}

async function showHealthSummary(options: CliOptions): Promise<void> {
  console.log('📊 Feed Health Summary');
  console.log('====================\n');

  const summary = await dbManager!.getFeedHealthSummary();
  
  if (summary.length === 0) {
    console.log('No health data available. Run health checks on your feeds first.');
    return;
  }

  if (options.format === 'json') {
    console.log(JSON.stringify(summary, null, 2));
    return;
  }

  // Display as table
  console.log('Feed ID'.padEnd(20) + 'Name'.padEnd(30) + 'Country'.padEnd(10) + 'Health'.padEnd(10) + 'Score'.padEnd(8) + 'Alerts');
  console.log('-'.repeat(90));
  
  summary.forEach(feed => {
    const status = getHealthStatusEmoji(feed.healthStatus);
    const score = feed.overallHealthScore ? feed.overallHealthScore.toFixed(1) : 'N/A';
    const alerts = feed.activeAlerts || 0;
    
    console.log(
      (feed.id || '').padEnd(20) +
      (feed.name || '').substring(0, 29).padEnd(30) +
      (feed.country || '').padEnd(10) +
      `${status} ${feed.healthStatus || 'unknown'}`.padEnd(10) +
      score.padEnd(8) +
      `${alerts > 0 ? '⚠️' : '✅'} ${alerts}`
    );
  });
  
  console.log(`\nTotal feeds: ${summary.length}`);
  const healthyFeeds = summary.filter(f => f.healthStatus === 'excellent' || f.healthStatus === 'good').length;
  console.log(`Healthy feeds: ${healthyFeeds} (${((healthyFeeds / summary.length) * 100).toFixed(1)}%)`);
}

async function showAlerts(options: CliOptions): Promise<void> {
  console.log('🚨 Active Health Alerts');
  console.log('======================\n');

  const alerts = await dbManager!.getActiveAlerts(options.feedId);
  
  if (alerts.length === 0) {
    console.log('✅ No active alerts found.');
    return;
  }

  // Filter by severity if specified
  const filteredAlerts = options.severity 
    ? alerts.filter(a => a.severity === options.severity)
    : alerts;

  if (options.format === 'json') {
    console.log(JSON.stringify(filteredAlerts, null, 2));
    return;
  }

  filteredAlerts.forEach(alert => {
    const severityEmoji = getSeverityEmoji(alert.severity);
    const timestamp = new Date(alert.timestamp).toLocaleString();
    
    console.log(`${severityEmoji} ${alert.severity.toUpperCase()}: ${alert.message}`);
    console.log(`   Feed: ${alert.feedId}`);
    console.log(`   Type: ${alert.type}`);
    console.log(`   Time: ${timestamp}`);
    console.log(`   ID: ${alert.id}\n`);
  });
  
  console.log(`Total alerts: ${filteredAlerts.length}`);
  if (options.severity) {
    console.log(`Filtered by severity: ${options.severity}`);
  }
  console.log('\n💡 Use "npm run health resolve <alert-id>" to resolve an alert');
}

async function resolveAlert(options: CliOptions): Promise<void> {
  const alertId = options.feedId; // Reusing feedId parameter for alert ID
  
  if (!alertId) {
    console.error('❌ Alert ID required');
    console.log('Usage: npm run health resolve <alert-id>');
    return;
  }

  await dbManager!.resolveAlert(alertId, 'cli-user');
  console.log(`✅ Alert ${alertId} has been resolved`);
}

async function analyzeVolume(options: CliOptions): Promise<void> {
  if (!options.feedId) {
    console.error('❌ Feed ID required for volume analysis');
    return;
  }

  console.log(`📊 Volume Analysis for Feed: ${options.feedId}`);
  console.log('=========================================\n');

  const dashboard = await analyzer!.analyzeFeedHealth(options.feedId, {
    feedId: options.feedId,
    analyzeVolume: true,
    analyzeQuality: false,
    analyzeCredibility: false,
    analyzeTechnical: false,
    analyzeRelevance: false,
    analyzeSpam: false,
    analyzeLocalization: false
  });

  const volume = dashboard.volume;
  
  console.log(`📰 Articles per day: ${volume.articlesPerDay.toFixed(1)}`);
  console.log(`⏰ Articles per hour: ${volume.articlesPerHour.toFixed(2)}`);
  console.log(`📊 Average frequency: ${(volume.averageFrequency / 60).toFixed(1)} hours between articles`);
  console.log(`📈 7-day trend: ${volume.volumeTrend7d >= 0 ? '+' : ''}${volume.volumeTrend7d.toFixed(1)}%`);
  console.log(`🎯 Expected range: ${volume.expectedRange[0]}-${volume.expectedRange[1]} articles/day`);
  console.log(`⚠️  Volume anomaly: ${volume.isVolumeAnomaly ? 'YES' : 'NO'}`);
  
  if (volume.publishingPattern) {
    console.log(`\n📅 Publishing Pattern:`);
    console.log(`   Peak hours: ${volume.publishingPattern.peakHours.join(', ')}`);
    console.log(`   Consistency: ${volume.publishingPattern.consistencyScore.toFixed(1)}%`);
    console.log(`   Batch publishing: ${volume.publishingPattern.batchPublishing ? 'Detected' : 'Not detected'}`);
  }
}

async function analyzeQuality(options: CliOptions): Promise<void> {
  if (!options.feedId) {
    console.error('❌ Feed ID required for quality analysis');
    return;
  }

  console.log(`📝 Content Quality Analysis for Feed: ${options.feedId}`);
  console.log('=============================================\n');

  const dashboard = await analyzer!.analyzeFeedHealth(options.feedId, {
    feedId: options.feedId,
    analyzeVolume: false,
    analyzeQuality: true,
    analyzeCredibility: false,
    analyzeTechnical: false,
    analyzeRelevance: false,
    analyzeSpam: false,
    analyzeLocalization: false
  });

  const quality = dashboard.quality;
  
  console.log(`📏 Average title length: ${quality.avgTitleLength.toFixed(1)} characters`);
  console.log(`📄 Average content length: ${quality.avgContentLength.toFixed(0)} characters`);
  console.log(`❌ Missing content: ${quality.missingContentPercentage.toFixed(1)}%`);
  console.log(`🔄 Duplicate content: ${quality.duplicateContentPercentage.toFixed(1)}%`);
  console.log(`🌐 Language consistency: ${quality.languageConsistency.toFixed(1)}%`);
  console.log(`📖 Readability score: ${quality.readabilityScore.toFixed(1)}/100`);
  console.log(`✍️  Spelling error rate: ${quality.spellingErrorRate.toFixed(2)}%`);
  
  console.log(`\n📊 Metadata Completeness:`);
  console.log(`   Has author: ${quality.hasAuthorPercentage.toFixed(1)}%`);
  console.log(`   Has date: ${quality.hasDatePercentage.toFixed(1)}%`);
  console.log(`   Has description: ${quality.hasDescriptionPercentage.toFixed(1)}%`);
  console.log(`   Valid links: ${quality.validLinksPercentage.toFixed(1)}%`);
}

async function analyzeCredibility(options: CliOptions): Promise<void> {
  if (!options.feedId) {
    console.error('❌ Feed ID required for credibility analysis');
    return;
  }

  console.log(`🛡️  Credibility Analysis for Feed: ${options.feedId}`);
  console.log('========================================\n');

  const dashboard = await analyzer!.analyzeFeedHealth(options.feedId, {
    feedId: options.feedId,
    analyzeVolume: false,
    analyzeQuality: false,
    analyzeCredibility: true,
    analyzeTechnical: false,
    analyzeRelevance: false,
    analyzeSpam: false,
    analyzeLocalization: false
  });

  const credibility = dashboard.credibility;
  
  console.log(`👥 Unique authors: ${credibility.uniqueAuthors}`);
  console.log(`🌐 Domain consistency: ${credibility.domainConsistency.toFixed(1)}%`);
  console.log(`🚩 Suspicious patterns: ${credibility.suspiciousPatterns.length} detected`);
  console.log(`🌙 Unusual publishing times: ${credibility.unusualPublishingTimes.toFixed(1)}%`);
  console.log(`✅ Authenticity score: ${credibility.avgAuthenticityScore.toFixed(1)}/100`);
  console.log(`🎣 Clickbait score: ${credibility.clickbaitScore.toFixed(1)}%`);
  console.log(`⚖️  Bias score: ${credibility.biasScore.toFixed(2)} (-1 to +1)`);
  
  if (credibility.suspiciousPatterns.length > 0) {
    console.log(`\n🔍 Suspicious Patterns Detected:`);
    credibility.suspiciousPatterns.forEach(pattern => {
      const severityEmoji = pattern.severity === 'high' ? '🔴' : pattern.severity === 'medium' ? '🟡' : '🟢';
      console.log(`   ${severityEmoji} ${pattern.type}: ${pattern.count} occurrences (${pattern.severity})`);
      console.log(`      ${pattern.description}`);
    });
  }
  
  if (Object.keys(credibility.authorDistribution).length > 0) {
    console.log(`\n📝 Top Authors:`);
    const topAuthors = Object.entries(credibility.authorDistribution)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5);
    
    topAuthors.forEach(([author, count]) => {
      console.log(`   ${author}: ${count} articles`);
    });
  }
}

async function analyzeTechnical(options: CliOptions): Promise<void> {
  if (!options.feedId) {
    console.error('❌ Feed ID required for technical analysis');
    return;
  }

  console.log(`⚙️  Technical Analysis for Feed: ${options.feedId}`);
  console.log('======================================\n');

  const dashboard = await analyzer!.analyzeFeedHealth(options.feedId, {
    feedId: options.feedId,
    analyzeVolume: false,
    analyzeQuality: false,
    analyzeCredibility: false,
    analyzeTechnical: true,
    analyzeRelevance: false,
    analyzeSpam: false,
    analyzeLocalization: false
  });

  const technical = dashboard.technical;
  
  console.log(`⬆️  Uptime: ${technical.uptime.toFixed(2)}%`);
  console.log(`⏱️  Average response time: ${technical.avgResponseTime.toFixed(0)}ms`);
  console.log(`❌ Error rate: ${technical.errorRate.toFixed(2)}%`);
  console.log(`📅 Last successful fetch: ${technical.lastSuccessfulFetch.toLocaleString()}`);
  console.log(`🔧 Parse success rate: ${technical.parseSuccessRate.toFixed(2)}%`);
  console.log(`🔤 Encoding issues: ${technical.encodingIssues}`);
  console.log(`📝 XML validity score: ${technical.xmlValidityScore.toFixed(1)}%`);
  console.log(`⏰ Timeouts: ${technical.timeouts}`);
  console.log(`🌐 DNS errors: ${technical.dnsErrors}`);
  
  if (Object.keys(technical.httpErrors).length > 0) {
    console.log(`\n🚫 HTTP Errors:`);
    Object.entries(technical.httpErrors).forEach(([code, count]) => {
      console.log(`   ${code}: ${count} occurrences`);
    });
  }
}

async function compareFeeds(options: CliOptions): Promise<void> {
  console.log('🆚 Feed Comparison');
  console.log('=================\n');
  
  // This would require two feed IDs - simplified for now
  console.log('Feature coming soon: Compare multiple feeds side by side');
  console.log('Usage: npm run health compare <feed1> <feed2>');
}

async function rankFeeds(options: CliOptions): Promise<void> {
  console.log('🏆 Feed Rankings');
  console.log('===============\n');

  const summary = await dbManager!.getFeedHealthSummary();
  
  if (summary.length === 0) {
    console.log('No health data available for ranking.');
    return;
  }

  // Sort by health score descending
  const ranked = summary
    .filter(f => f.overallHealthScore != null)
    .sort((a, b) => (b.overallHealthScore || 0) - (a.overallHealthScore || 0));

  console.log('Rank'.padEnd(6) + 'Feed'.padEnd(25) + 'Country'.padEnd(10) + 'Score'.padEnd(8) + 'Status');
  console.log('-'.repeat(65));

  ranked.forEach((feed, index) => {
    const rank = `#${index + 1}`;
    const status = getHealthStatusEmoji(feed.healthStatus);
    const score = feed.overallHealthScore?.toFixed(1) || 'N/A';
    
    console.log(
      rank.padEnd(6) +
      (feed.name || '').substring(0, 24).padEnd(25) +
      (feed.country || '').padEnd(10) +
      score.padEnd(8) +
      `${status} ${feed.healthStatus}`
    );
  });
}

async function findOutliers(options: CliOptions): Promise<void> {
  console.log('🎯 Feed Outliers Detection');
  console.log('=========================\n');

  const summary = await dbManager!.getFeedHealthSummary();
  
  if (summary.length < 3) {
    console.log('Need at least 3 feeds to detect outliers.');
    return;
  }

  const scores = summary.map(f => f.overallHealthScore || 0);
  const mean = scores.reduce((sum, score) => sum + score, 0) / scores.length;
  const stdDev = Math.sqrt(scores.reduce((sum, score) => sum + Math.pow(score - mean, 2), 0) / scores.length);
  
  console.log(`📊 Average health score: ${mean.toFixed(1)}`);
  console.log(`📏 Standard deviation: ${stdDev.toFixed(1)}\n`);

  const outliers = summary.filter(feed => {
    const score = feed.overallHealthScore || 0;
    return Math.abs(score - mean) > stdDev * 2; // 2 standard deviations
  });

  if (outliers.length === 0) {
    console.log('✅ No significant outliers detected.');
    return;
  }

  console.log(`🚨 Found ${outliers.length} outlier(s):`);
  outliers.forEach(feed => {
    const score = feed.overallHealthScore || 0;
    const deviation = ((score - mean) / stdDev).toFixed(1);
    const trend = score > mean ? '📈 Above average' : '📉 Below average';
    
    console.log(`\n• ${feed.name} (${feed.country})`);
    console.log(`  Score: ${score.toFixed(1)} (${deviation}σ deviation)`);
    console.log(`  Status: ${trend}`);
    console.log(`  Active alerts: ${feed.activeAlerts || 0}`);
  });
}

async function startMonitoring(options: CliOptions): Promise<void> {
  console.log('🔄 Starting Health Monitoring');
  console.log('============================\n');
  
  const intervalMinutes = 60; // Check every hour
  console.log(`📅 Monitoring interval: ${intervalMinutes} minutes`);
  console.log('💡 Press Ctrl+C to stop\n');

  // Graceful shutdown
  process.on('SIGINT', () => {
    console.log('\n🛑 Stopping health monitoring...');
    process.exit(0);
  });

  const monitor = async () => {
    try {
      console.log(`⏰ ${new Date().toLocaleString()} - Running health checks...`);
      
      const summary = await dbManager!.getFeedHealthSummary();
      let checksRun = 0;
      let alertsGenerated = 0;
      
      for (const feed of summary.slice(0, 5)) { // Limit to 5 feeds per run
        if (feed.isActive) {
          const dashboard = await analyzer!.analyzeFeedHealth(feed.id);
          await dbManager!.saveHealthSnapshot(dashboard);
          
          for (const alert of dashboard.alerts) {
            await dbManager!.saveHealthAlert(alert);
            alertsGenerated++;
          }
          
          checksRun++;
        }
      }
      
      console.log(`✅ Completed ${checksRun} health checks, generated ${alertsGenerated} alerts\n`);
    } catch (error) {
      console.error('❌ Error during monitoring:', error instanceof Error ? error.message : error);
    }
  };

  // Initial run
  await monitor();
  
  // Set up interval
  setInterval(monitor, intervalMinutes * 60 * 1000);
}

async function generateReport(options: CliOptions): Promise<void> {
  const period = options.days || 7;
  console.log(`📋 Health Report - Last ${period} Days`);
  console.log('=' .repeat(35 + period.toString().length));
  console.log(`Generated: ${new Date().toLocaleString()}\n`);

  const summary = await dbManager!.getFeedHealthSummary();
  
  if (summary.length === 0) {
    console.log('No health data available for report generation.');
    return;
  }

  // Overall statistics
  const totalFeeds = summary.length;
  const activeFeeds = summary.filter(f => f.isActive).length;
  const healthyFeeds = summary.filter(f => f.healthStatus === 'excellent' || f.healthStatus === 'good').length;
  const criticalFeeds = summary.filter(f => f.healthStatus === 'critical' || f.healthStatus === 'down').length;
  const avgScore = summary.reduce((sum, f) => sum + (f.overallHealthScore || 0), 0) / totalFeeds;

  console.log('📊 EXECUTIVE SUMMARY');
  console.log('-------------------');
  console.log(`Total feeds monitored: ${totalFeeds}`);
  console.log(`Active feeds: ${activeFeeds}`);
  console.log(`Healthy feeds: ${healthyFeeds} (${((healthyFeeds / totalFeeds) * 100).toFixed(1)}%)`);
  console.log(`Critical feeds: ${criticalFeeds} (${((criticalFeeds / totalFeeds) * 100).toFixed(1)}%)`);
  console.log(`Average health score: ${avgScore.toFixed(1)}/100`);

  // Alerts summary
  const alerts = await dbManager!.getActiveAlerts();
  const criticalAlerts = alerts.filter(a => a.severity === 'critical').length;
  const errorAlerts = alerts.filter(a => a.severity === 'error').length;
  const warningAlerts = alerts.filter(a => a.severity === 'warning').length;

  console.log(`\n🚨 ALERTS SUMMARY`);
  console.log('----------------');
  console.log(`Total active alerts: ${alerts.length}`);
  console.log(`Critical: ${criticalAlerts}, Errors: ${errorAlerts}, Warnings: ${warningAlerts}`);

  // Top/Bottom performers
  const sortedFeeds = summary
    .filter(f => f.overallHealthScore != null)
    .sort((a, b) => (b.overallHealthScore || 0) - (a.overallHealthScore || 0));

  if (sortedFeeds.length > 0) {
    console.log(`\n🏆 TOP PERFORMERS`);
    console.log('----------------');
    sortedFeeds.slice(0, 3).forEach((feed, index) => {
      console.log(`${index + 1}. ${feed.name} (${feed.country}) - ${(feed.overallHealthScore || 0).toFixed(1)}/100`);
    });

    console.log(`\n⚠️  NEEDS ATTENTION`);
    console.log('------------------');
    sortedFeeds.slice(-3).reverse().forEach((feed, index) => {
      console.log(`${index + 1}. ${feed.name} (${feed.country}) - ${(feed.overallHealthScore || 0).toFixed(1)}/100`);
    });
  }

  console.log(`\n📝 Report generated successfully`);
  console.log(`💡 Use individual commands for detailed analysis of specific feeds`);
}

async function showDashboard(options: CliOptions): Promise<void> {
  console.log('🖥️  RSS Feed Health Dashboard');
  console.log('============================\n');

  const summary = await dbManager!.getFeedHealthSummary();
  const alerts = await dbManager!.getActiveAlerts();
  
  // System overview
  const totalFeeds = summary.length;
  const healthyFeeds = summary.filter(f => f.healthStatus === 'excellent' || f.healthStatus === 'good').length;
  const criticalAlerts = alerts.filter(a => a.severity === 'critical').length;
  
  console.log('📊 SYSTEM STATUS');
  console.log(`Feeds: ${totalFeeds} | Healthy: ${healthyFeeds} | Critical Alerts: ${criticalAlerts}`);
  console.log();

  // Quick feed status
  if (summary.length > 0) {
    console.log('🔍 FEED STATUS OVERVIEW');
    console.log('Feed'.padEnd(25) + 'Country'.padEnd(10) + 'Health'.padEnd(15) + 'Score'.padEnd(8) + 'Alerts');
    console.log('-'.repeat(70));
    
    summary.slice(0, 10).forEach(feed => {
      const status = getHealthStatusEmoji(feed.healthStatus);
      const score = feed.overallHealthScore ? feed.overallHealthScore.toFixed(1) : 'N/A';
      const alertCount = alerts.filter(a => a.feedId === feed.id).length;
      
      console.log(
        (feed.name || '').substring(0, 24).padEnd(25) +
        (feed.country || '').padEnd(10) +
        `${status} ${feed.healthStatus || 'unknown'}`.padEnd(15) +
        score.padEnd(8) +
        (alertCount > 0 ? `⚠️ ${alertCount}` : '✅ 0')
      );
    });
    
    if (summary.length > 10) {
      console.log(`... and ${summary.length - 10} more feeds`);
    }
  }

  // Recent alerts
  if (alerts.length > 0) {
    console.log('\n🚨 RECENT ALERTS (Last 5)');
    console.log('-'.repeat(50));
    
    alerts.slice(0, 5).forEach(alert => {
      const severityEmoji = getSeverityEmoji(alert.severity);
      const time = new Date(alert.timestamp).toLocaleString();
      console.log(`${severityEmoji} [${time}] ${alert.message}`);
    });
    
    if (alerts.length > 5) {
      console.log(`... and ${alerts.length - 5} more alerts`);
    }
  }

  console.log('\n💡 QUICK ACTIONS');
  console.log('Run "npm run health check <feed-id>" for detailed analysis');
  console.log('Run "npm run health alerts" to see all active alerts');
  console.log('Run "npm run health summary" for complete feed overview');
}

async function displayHealthDashboard(dashboard: FeedHealthDashboard, detailed: boolean): Promise<void> {
  const status = getHealthStatusEmoji(dashboard.healthStatus);
  
  console.log(`🏥 Health Dashboard: ${dashboard.feedName}`);
  console.log('='.repeat(50 + dashboard.feedName.length));
  console.log(`📡 Feed URL: ${dashboard.feedUrl}`);
  console.log(`🌍 Country: ${dashboard.country} | 📂 Category: ${dashboard.category} | 🗣️ Language: ${dashboard.language}`);
  console.log(`${status} Overall Health: ${dashboard.healthStatus.toUpperCase()} (${dashboard.overallHealthScore.toFixed(1)}/100)`);
  console.log(`📅 Last analyzed: ${dashboard.lastAnalyzed.toLocaleString()}\n`);

  // Volume metrics
  console.log('📊 VOLUME METRICS');
  console.log('-'.repeat(20));
  console.log(`Articles per day: ${dashboard.volume.articlesPerDay.toFixed(1)}`);
  console.log(`Average frequency: ${(dashboard.volume.averageFrequency / 60).toFixed(1)} hours`);
  console.log(`Volume trend (7d): ${dashboard.volume.volumeTrend7d >= 0 ? '+' : ''}${dashboard.volume.volumeTrend7d.toFixed(1)}%`);
  
  if (detailed) {
    console.log(`Articles per hour: ${dashboard.volume.articlesPerHour.toFixed(2)}`);
    console.log(`Expected range: ${dashboard.volume.expectedRange[0]}-${dashboard.volume.expectedRange[1]} articles/day`);
    console.log(`Volume anomaly: ${dashboard.volume.isVolumeAnomaly ? '⚠️ YES' : '✅ NO'}`);
  }

  // Quality metrics
  console.log('\n📝 QUALITY METRICS');
  console.log('-'.repeat(20));
  console.log(`Content completeness: ${(100 - dashboard.quality.missingContentPercentage).toFixed(1)}%`);
  console.log(`Readability score: ${dashboard.quality.readabilityScore.toFixed(1)}/100`);
  console.log(`Metadata completeness: ${dashboard.quality.hasAuthorPercentage.toFixed(1)}% have authors`);
  
  if (detailed) {
    console.log(`Average title length: ${dashboard.quality.avgTitleLength.toFixed(1)} chars`);
    console.log(`Average content length: ${dashboard.quality.avgContentLength.toFixed(0)} chars`);
    console.log(`Duplicate content: ${dashboard.quality.duplicateContentPercentage.toFixed(1)}%`);
    console.log(`Language consistency: ${dashboard.quality.languageConsistency.toFixed(1)}%`);
  }

  // Technical metrics
  console.log('\n⚙️ TECHNICAL METRICS');
  console.log('-'.repeat(20));
  console.log(`Uptime: ${dashboard.technical.uptime.toFixed(1)}%`);
  console.log(`Average response time: ${dashboard.technical.avgResponseTime.toFixed(0)}ms`);
  console.log(`Parse success rate: ${dashboard.technical.parseSuccessRate.toFixed(1)}%`);
  
  if (detailed) {
    console.log(`Error rate: ${dashboard.technical.errorRate.toFixed(2)}%`);
    console.log(`Last successful fetch: ${dashboard.technical.lastSuccessfulFetch.toLocaleString()}`);
    console.log(`Encoding issues: ${dashboard.technical.encodingIssues}`);
  }

  // Credibility metrics
  console.log('\n🛡️ CREDIBILITY METRICS');
  console.log('-'.repeat(20));
  console.log(`Unique authors: ${dashboard.credibility.uniqueAuthors}`);
  console.log(`Authenticity score: ${dashboard.credibility.avgAuthenticityScore.toFixed(1)}/100`);
  console.log(`Clickbait detection: ${dashboard.credibility.clickbaitScore.toFixed(1)}%`);
  console.log(`Suspicious patterns: ${dashboard.credibility.suspiciousPatterns.length} detected`);

  // Alerts
  if (dashboard.alerts.length > 0) {
    console.log('\n🚨 ACTIVE ALERTS');
    console.log('-'.repeat(20));
    dashboard.alerts.forEach(alert => {
      const severityEmoji = getSeverityEmoji(alert.severity);
      console.log(`${severityEmoji} ${alert.severity.toUpperCase()}: ${alert.message}`);
    });
  }

  // Recommendations
  if (dashboard.recommendations.length > 0) {
    console.log('\n💡 RECOMMENDATIONS');
    console.log('-'.repeat(20));
    dashboard.recommendations.forEach(rec => {
      console.log(`• ${rec}`);
    });
  }
}

function getHealthStatusEmoji(status: string): string {
  switch (status) {
    case 'excellent': return '🟢';
    case 'good': return '🟡';
    case 'warning': return '🟠';
    case 'critical': return '🔴';
    case 'down': return '⚫';
    default: return '⚪';
  }
}

function getSeverityEmoji(severity: string): string {
  switch (severity) {
    case 'critical': return '🔴';
    case 'error': return '🟠';
    case 'warning': return '🟡';
    case 'info': return '🔵';
    default: return '⚪';
  }
}

function showHelp(): void {
  console.log('🏥 RSS Feed Health Monitoring CLI');
  console.log('================================\n');
  
  console.log('COMMANDS:');
  console.log('  check <feed-id>        Perform comprehensive health check on a feed');
  console.log('  summary                Show health summary for all feeds');
  console.log('  alerts                 Show active health alerts');
  console.log('  resolve <alert-id>     Resolve a specific alert');
  console.log('  volume <feed-id>       Analyze volume metrics for a feed');
  console.log('  quality <feed-id>      Analyze content quality for a feed');
  console.log('  credibility <feed-id>  Analyze credibility metrics for a feed');
  console.log('  technical <feed-id>    Analyze technical metrics for a feed');
  console.log('  compare <feed1> <feed2> Compare two feeds (coming soon)');
  console.log('  ranking                Show feeds ranked by health score');
  console.log('  outliers               Find feeds with unusual health metrics');
  console.log('  monitor                Start continuous health monitoring');
  console.log('  report                 Generate comprehensive health report');
  console.log('  dashboard              Show live health dashboard');
  console.log('  help                   Show this help message\n');
  
  console.log('OPTIONS:');
  console.log('  --feed=<id>           Specify feed ID');
  console.log('  --days=<n>            Look back N days (default: 7)');
  console.log('  --format=<type>       Output format: table|json|summary (default: table)');
  console.log('  --severity=<level>    Filter alerts by severity: info|warning|error|critical');
  console.log('  --detailed            Show detailed metrics');
  console.log('  --resolve             Resolve alerts after showing them\n');
  
  console.log('EXAMPLES:');
  console.log('  npm run health check us-tech-news');
  console.log('  npm run health summary --format=json');
  console.log('  npm run health alerts --severity=critical');
  console.log('  npm run health volume us-tech-news --days=30');
  console.log('  npm run health monitor');
  console.log('  npm run health report --days=14\n');
  
  console.log('💡 Make sure to run RSS polling first to have data for analysis');
}

// Ensure data directory exists
const dataDir = path.dirname(DB_PATH);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Run main function
main().catch(console.error);