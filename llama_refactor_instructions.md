# Route Refactoring Instructions for LLaMA 7B

## Overview
The application has database syntax errors because route files contain direct SQL queries using SQLite syntax instead of using the repository layer. This document provides clear instructions to refactor routes to use repository methods.

## Problem Summary
- **Current Issue**: Routes bypass repository layer with direct `db.get()`, `db.all()`, `db.run()` calls
- **SQLite Syntax Used**: `?` parameters, causing PostgreSQL errors
- **Files Affected**: `apps/api/src/routes/articles.ts` (primary), possibly others
- **Test Impact**: 38 failed tests due to "syntax error at or near OFFSET"

## Architecture Pattern
```
Route Handler → Repository Method → Database Connection
     ❌ CURRENT: Route → Direct DB Query (SQLite syntax)
     ✅ TARGET:  Route → Repository Method → DB Query (PostgreSQL syntax)
```

## File to Fix: `apps/api/src/routes/articles.ts`

### Current Problems Found
| Line | Current Code | Issue |
|------|-------------|-------|
| 52 | `WHERE feed_id = ?` | SQLite parameter syntax |
| 53 | `WHERE feed_id = ?` | SQLite parameter syntax |
| 57 | `LIMIT ? OFFSET ?` | **Main test failure** - SQLite syntax |
| 84 | `WHERE id = ?` | SQLite parameter syntax |
| 98 | `WHERE url = ?` | SQLite parameter syntax |

### Available Repository Methods
Located in `apps/api/src/repositories/`:

#### ArticleRepository Methods
```typescript
// Available methods in ArticleRepository
async findMany(options: DatabaseFilterOptions): Promise<DatabaseArticle[]>
async countMany(options: DatabaseFilterOptions): Promise<number>  
async findById(id: string): Promise<DatabaseArticle | null>
async findByUrl(url: string): Promise<DatabaseArticle | null>
async findByFeedId(feedId: string, limit: number): Promise<DatabaseArticle[]>
async create(data: CreateArticleData): Promise<string>
async update(id: string, data: UpdateArticleData): Promise<boolean>
async delete(id: string): Promise<boolean>
async existsByUrl(url: string): Promise<boolean>
```

#### FeedRepository Methods  
```typescript
// Available methods in FeedRepository
async findById(id: string): Promise<DatabaseRSSFeed | null>
async existsByUrl(url: string): Promise<boolean>
// ... other methods
```

## Specific Refactoring Tasks

### Task 1: Fix GET /articles Route (Lines ~40-78)
**Current**: Direct SQL queries with pagination
**Target**: Use repository methods

**Steps**:
1. **Import repositories** at top of file:
   ```typescript
   import { articleRepository, feedRepository } from "../repositories/index.js";
   ```

2. **Replace direct queries** in GET /articles handler:
   
   **BEFORE** (lines ~52-63):
   ```typescript
   // Current problematic code
   if (feed_id) {
     articlesQuery += " WHERE feed_id = ?";
     countQuery += " WHERE feed_id = ?";
     queryParams.push(feed_id);
   }
   articlesQuery += " ORDER BY published_at DESC LIMIT ? OFFSET ?";
   const [articles, totalResult] = await Promise.all([
     db.all<ArticleRow>(articlesQuery, ...articlesParams),
     db.get<{ count: number }>(countQuery, ...countParams)
   ]);
   ```
   
   **AFTER**:
   ```typescript
   // Use repository methods instead
   const filterOptions: DatabaseFilterOptions = {
     sortBy: 'publishedAt',
     limit: paginationQuery.limit,
     offset: offset
   };
   
   if (feed_id) {
     // Use findByFeedId method instead of direct query
     const articles = await articleRepository.findByFeedId(feed_id, paginationQuery.limit);
     const total = articles.length; // Or implement count method for feed
   } else {
     // Use findMany method for general queries
     const [articles, total] = await Promise.all([
       articleRepository.findMany(filterOptions),
       articleRepository.countMany(filterOptions)
     ]);
   }
   ```

### Task 2: Fix POST /articles Route (Lines ~80-120)
**Current**: Direct feed validation query
**Target**: Use repository method

**Steps**:
1. **Replace feed validation** (line ~84):
   
   **BEFORE**:
   ```typescript
   const existingFeed = await db.get(
     "SELECT id FROM feeds WHERE id = ?",
     input.feed_id
   );
   ```
   
   **AFTER**:
   ```typescript
   const existingFeed = await feedRepository.findById(input.feed_id);
   ```

2. **Replace article URL check** (line ~98):
   
   **BEFORE**:
   ```typescript
   const existingArticle = await db.get(
     "SELECT id FROM articles WHERE url = ?",
     input.url
   );
   ```
   
   **AFTER**:
   ```typescript
   const existingArticle = await articleRepository.findByUrl(input.url);
   ```

3. **Replace article creation** (if using direct INSERT):
   
   **BEFORE**: Direct INSERT query
   
   **AFTER**:
   ```typescript
   const articleId = await articleRepository.create({
     id: uuidv4(),
     feed_id: input.feed_id,
     title: input.title,
     // ... other fields
     created_at: new Date().toISOString(),
     scraped_at: new Date().toISOString()
   });
   ```

### Task 3: Fix Other Route Methods
Apply similar pattern to:
- **PUT /articles/:id** - Use `articleRepository.update()`
- **DELETE /articles/:id** - Use `articleRepository.delete()`  
- **GET /articles/:id** - Use `articleRepository.findById()`

## Implementation Checklist

### Pre-Work
- [ ] Verify repository methods exist and work correctly
- [ ] Check repository imports are available
- [ ] Review DatabaseFilterOptions interface

### Main Refactoring
- [ ] Add repository imports to articles.ts
- [ ] Refactor GET /articles pagination logic
- [ ] Replace feed validation queries
- [ ] Replace article URL checking  
- [ ] Replace direct INSERT/UPDATE/DELETE operations
- [ ] Remove all direct `db.get()`, `db.all()`, `db.run()` calls

### Testing
- [ ] Run TypeScript compilation: `npm run typecheck`
- [ ] Test specific routes work: `docker-compose exec api npm test`
- [ ] Verify no more "syntax error at or near OFFSET" errors

## Expected Outcomes

### Before Refactoring
```
❌ Database ALL error: SELECT * FROM articles ORDER BY published_at DESC LIMIT ? OFFSET ?
❌ 38 failed tests
❌ Multiple SQLite syntax errors
```

### After Refactoring  
```
✅ Repository methods handle PostgreSQL syntax correctly
✅ Cleaner separation of concerns
✅ All database operations go through repository layer
✅ Tests should pass with proper PostgreSQL queries
```

## Error Prevention

### Do NOT:
- Use direct `db.get()`, `db.all()`, `db.run()` in route files
- Use `?` parameter syntax anywhere
- Write raw SQL queries in routes

### DO:
- Use repository methods for all database operations
- Let repositories handle SQL syntax and parameters
- Follow the established repository pattern
- Import and use existing repository instances

## Files to Modify

### Primary Target
- `apps/api/src/routes/articles.ts` - **CRITICAL** (contains main failures)

### Secondary Targets (if found)
- Check other route files for similar patterns:
  - `apps/api/src/routes/feeds.ts`
  - `apps/api/src/routes/polling.ts` 
  - `apps/api/src/routes/newsletter.ts`

## Success Criteria
1. **Zero direct database queries** in route files
2. **All database operations** use repository methods
3. **Tests pass** without SQLite syntax errors
4. **TypeScript compilation** succeeds
5. **Proper separation** of concerns maintained

---

## Quick Reference: Repository Import
```typescript
// Add this import at the top of route files
import { articleRepository, feedRepository } from "../repositories/index.js";

// Then use methods like:
await articleRepository.findMany(options);
await feedRepository.findById(id);
```

This refactoring will eliminate the SQLite syntax errors and create a cleaner, more maintainable codebase following the established repository pattern.