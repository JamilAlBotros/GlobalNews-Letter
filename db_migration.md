# Database Migration: SQLite to PostgreSQL

## Overview
This document tracks the migration from SQLite to PostgreSQL parameter binding syntax throughout the codebase.

## Analysis Results
From test failures, identified 37 failing tests due to database issues:

### Primary Issues
1. **SQL Syntax Incompatibility**: Using SQLite parameter syntax (`?`) with PostgreSQL
2. **Database Test Setup**: Foreign key violations and missing test data
3. **Service Interface Mismatches**: Method signature differences

### Error Patterns
- `syntax error at or near "OFFSET"` - PostgreSQL expects `$1, $2` not `?`
- `articles_feed_id_fkey` violations - articles referencing non-existent feeds
- `service.generatePreview is not a function` - method signature mismatches

## Migration Plan

### Phase 1: SQL Syntax Migration (CRITICAL)
**Objective**: Convert all SQLite parameter syntax to PostgreSQL

**Files to Process**:
- ✅ `apps/api/src/repositories/polling-job.ts` (already completed)
- 🔄 `apps/api/src/repositories/article.ts` (in progress)
- ⏳ `apps/api/src/repositories/feed.ts`
- ⏳ `apps/api/src/repositories/base.ts`
- ⏳ Other repositories in index.ts

**Conversion Rules**:
- `?` → `$1, $2, $3...` (sequential numbering)
- Maintain parameter order in query vs values array
- Update both query strings and parameter passing

### Phase 2: Database Test Setup
**Objective**: Fix foreign key violations and test data setup

**Tasks**:
- Review test database initialization
- Create proper test data seeding (feeds before articles)
- Ensure cleanup between tests

### Phase 3: Service Interface Alignment
**Objective**: Fix service method signature mismatches

**Tasks**:
- Newsletter service method updates
- Other service interface alignments

## Migration Progress

### Phase 1 Execution Log

#### Starting State
- Total failing tests: 37/66
- Primary cause: SQL syntax errors

#### Article Repository Analysis (`apps/api/src/repositories/article.ts`)
**Issues Found**:
- Lines 84, 95, 101, 106, 111-113: Using `?` placeholders in SQLite style
- Line 123: `LIMIT ? OFFSET ?` causing the main test failures
- Lines 156, 167, 173, 178, 183-185: More `?` parameter usage in count queries

**Status**: ✅ FIXED - Converted all SQLite syntax to PostgreSQL
**Priority**: CRITICAL - this is causing the "syntax error at or near OFFSET" failures

**Changes Made**:
- Lines 84, 95: Fixed categories/sources IN clauses with dynamic parameter numbering
- Line 90: Fixed language parameter
- Lines 101, 106: Fixed date range parameters
- Lines 111-113: Fixed keyword LIKE parameters with proper numbering
- Line 123: Fixed LIMIT/OFFSET pagination - **KEY FIX**

#### Feed Repository Analysis (`apps/api/src/repositories/feed.ts`)
**Issues Found**:
- Lines 150, 155, 160, 165, 170, 175, 180, 189: Multiple `?` parameters in update method
- Line 193: `WHERE id = ?` in update query
- Line 239: `WHERE url = ?` in existsByUrl method  
- Lines 330, 335, 340: Multiple `?` parameters in criteria filtering

**Status**: ✅ FIXED - Converted all SQLite syntax to PostgreSQL
**Priority**: HIGH - affecting feed CRUD operations

**Changes Made**:
- Lines 150-180: Fixed all update method parameter placeholders with dynamic numbering
- Line 193: Fixed WHERE clause in update method
- Line 239: Fixed existsByUrl method parameter
- Lines 330, 335, 340: Fixed criteria filtering parameters with dynamic numbering

#### Base Repository Analysis (`apps/api/src/repositories/base.ts`)
**Issues Found**: None - uses dynamic parameter passing via `...params`
**Status**: ✅ CLEAN - No SQLite syntax, all methods use parameter spreading

#### Repository Index Analysis (`apps/api/src/repositories/index.ts`)
**Issues Found**: None - only exports, no SQL queries
**Status**: ✅ CLEAN - No SQL code

#### Phase 1 Summary
**Repositories Processed**: 5/5
- ✅ polling-job.ts (already fixed)
- ✅ article.ts (fixed - CRITICAL pagination issue resolved)
- ✅ feed.ts (fixed - all CRUD operations updated)
- ✅ base.ts (clean - no issues)
- ✅ index.ts (clean - no SQL code)

**Critical Fixes**:
- Fixed `LIMIT ? OFFSET ?` → `LIMIT $1 OFFSET $2` - **resolves main test failures**
- Fixed all dynamic parameter numbering in complex queries
- Updated all CRUD operations to use PostgreSQL syntax

**Verification**:
- ✅ TypeScript compilation: PASSED - No type errors
- 🔄 Next: Test database operations to verify syntax fixes

---

## Phase 2: Database Test Setup and Seeding

**Objective**: Fix foreign key violations and missing test data

### Analysis of Foreign Key Issues
From test failures:
```
error: insert or update on table "articles" violates foreign key constraint "articles_feed_id_fkey"
Key (feed_id)=(40a5871b-7150-4fd3-859c-01402caf2dd8) is not present in table "feeds"
```

**Root Cause**: Tests trying to create articles with non-existent feed_ids

### Investigation Results

#### Test Database Reset Issue
**Problem Found**: In `resetDatabase()` function (`apps/api/src/database/connection.ts:139`)
```typescript
export function resetDatabase(): void {
  closeDatabase(); // Only closes connection, doesn't reset data!
}
```

**Issue**: `resetDatabase()` only closes the connection but doesn't actually reset/clear the database

#### Foreign Key Violation Pattern
From `guardian-polling.test.ts` and `articles.test.ts`:
1. Tests call `resetDatabase()` - but this doesn't clear data
2. Tests use `beforeEach` with `DELETE FROM articles; DELETE FROM feeds`  
3. **Problem**: Using `db.run()` without `await` - deletions may not complete before test runs
4. Tests create feeds via API calls, then polling tries to create articles
5. Race condition: articles created with feed_ids that may not exist yet

#### Critical Issues Found
1. **Non-awaited DELETE operations** in `beforeEach` blocks
2. **resetDatabase() is ineffective** - doesn't actually reset data
3. **Async race conditions** between test setup and execution

### Phase 2 Fixes Applied

#### 1. Fixed resetDatabase() Function
**File**: `apps/api/src/database/connection.ts`
**Changes**:
- Made function `async` and properly clears all data
- Added proper DELETE order: articles → polling_jobs → feeds (respects foreign keys)
- Added error handling with warnings

#### 2. Fixed Async DELETE Operations
**Files Updated**: All test files with database cleanup
- ✅ `guardian-polling.test.ts` - await added to DELETE operations
- ✅ `articles.test.ts` - await added to DELETE operations  
- ✅ `feeds.test.ts` - await added to both beforeEach locations
- ✅ `polling-simple.test.ts` - await added to DELETE operations
- ✅ `newsletter.test.ts` - await added to DELETE operations
- ✅ `polling-integration.test.ts` - await added to DELETE operations
- ✅ `polling-manual-review.test.ts` - await added to DELETE operations

**Key Fix**: Changed `db.run("DELETE...")` → `await db.run("DELETE...")` 
**Impact**: Ensures deletions complete before test execution, preventing foreign key violations

### Test Results After Phase 2
**Status**: ❌ **ISSUES REMAIN** - Additional problems discovered

#### Remaining SQL Syntax Issues
**Critical**: Still seeing SQLite syntax in non-repository files
```
Database ALL error: SELECT * FROM articles ORDER BY published_at DESC LIMIT ? OFFSET ?
Database GET error: SELECT id FROM feeds WHERE id = ? error: syntax error at end of input
```

**Root Cause**: SQL queries exist outside of repository files that weren't migrated
**Location**: Likely in `/routes/articles.ts` and other route files

#### Foreign Key Issues Still Present
```
Key (feed_id)=(356bc424-2e5c-4fb2-b731-370b797e760b) is not present in table "feeds"
```
**Root Cause**: Database operations in routes bypass repository layer with old syntax

### Analysis: Routes Using Direct Database Queries
**Problem**: Route files contain direct SQL queries using SQLite syntax
**Files to investigate**: 
- `apps/api/src/routes/articles.ts:61` (LIMIT/OFFSET)
- `apps/api/src/routes/articles.ts:83` (WHERE clause)
- Other route files with direct DB access

#### Found SQLite Syntax in Routes
**File**: `apps/api/src/routes/articles.ts`
**Issues Found**:
- Line 57: `LIMIT ? OFFSET ?` - causing main test failures
- Line 52: `WHERE feed_id = ?` 
- Line 53: `WHERE feed_id = ?`
- Line 84: `WHERE id = ?` - causing "syntax error at end of input"
- Line 98: `WHERE url = ?`

**Root Cause**: Routes bypassing repository layer, using direct DB queries with SQLite syntax

---

## Phase 1.5: Route Refactoring (CRITICAL)

**Status**: 🔄 **INSTRUCTIONS CREATED** - Ready for implementation

### Problem Identified
**Architecture Issue**: Route files bypass the repository layer and contain direct SQL queries using SQLite syntax. This violates the established repository pattern and causes PostgreSQL syntax errors.

```
❌ CURRENT: Route Handler → Direct DB Query (SQLite syntax)
✅ TARGET:  Route Handler → Repository Method → DB Query (PostgreSQL syntax)
```

### Solution Created
**File**: `llama_refactor_instructions.md` - Comprehensive refactoring guide

**Key Requirements**:
1. **Import repositories** in route files
2. **Replace all direct database calls** with repository methods
3. **Remove SQLite syntax** (`?` parameters, direct queries)
4. **Use existing repository methods** for all database operations

### Critical Route File to Fix
**File**: `apps/api/src/routes/articles.ts`
- Line 57: `LIMIT ? OFFSET ?` ← **Main test failure cause**
- Lines 52,53,84,98: Various SQLite parameter usage

### Implementation Impact
- **Before**: 38 failed tests due to SQLite syntax errors
- **After**: Should resolve all "syntax error at or near OFFSET" failures
- **Architecture**: Clean separation of concerns, proper repository usage

**Next Step**: Follow `llama_refactor_instructions.md` to refactor route files
