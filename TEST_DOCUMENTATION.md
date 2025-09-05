# GlobalNewsLetter Test Suite Documentation

This document provides a comprehensive overview of all tests in the GlobalNewsLetter application, explaining their purpose, functionality, and what they validate.

## Test Structure Overview

The test suite is organized into several categories:

- **Core API Tests** - Basic CRUD operations for feeds and articles
- **RSS Polling Tests** - Real-world RSS feed processing and integration
- **Language Detection Tests** - AI-powered language identification
- **Newsletter Generation Tests** - Email newsletter creation functionality
- **Integration Tests** - End-to-end workflow validation

## Core API Tests

### `feeds.test.ts` - Feed Management API
Tests the core feed CRUD operations that manage RSS feed sources.

#### Test Cases:
1. **GET /feeds returns empty array when no feeds**
   - Validates initial empty state
   - Ensures proper pagination structure

2. **POST /feeds creates a new feed** 
   - Tests feed creation with all required fields
   - Validates RSS feed validation during creation
   - Ensures proper UUID generation and timestamps

3. **POST /feeds returns 409 for duplicate URL**
   - Tests duplicate URL prevention
   - Validates unique constraint on feed URLs
   - Ensures proper error response format

4. **GET /feeds/:id returns feed by ID**
   - Tests individual feed retrieval
   - Validates feed data structure

5. **GET /feeds/:id returns 404 for non-existent feed**
   - Tests error handling for missing feeds
   - Validates proper HTTP error responses

6. **PUT /feeds/:id updates feed**
   - Tests feed modification
   - Validates partial updates
   - Ensures updated_at timestamp changes

7. **DELETE /feeds/:id deletes feed**
   - Tests feed removal
   - Validates proper cleanup

8. **GET /feeds with pagination**
   - Tests pagination functionality
   - Validates page limits and offsets
   - Ensures proper total count calculation

### `articles.test.ts` - Article Management API  
Tests article CRUD operations and relationships with feeds.

#### Test Cases:
1. **GET /articles returns empty array when no articles**
   - Validates initial state
   - Tests pagination structure

2. **POST /articles creates a new article**
   - Tests article creation with all fields
   - Validates feed relationship (foreign key)
   - Tests language detection integration
   - Ensures proper timestamp handling

3. **POST /articles returns 400 for non-existent feed**
   - Tests referential integrity
   - Validates feed existence before article creation

4. **POST /articles returns 409 for duplicate URL**
   - Tests duplicate article prevention
   - Validates unique URL constraint per article

5. **GET /articles/:id returns article by ID**
   - Tests individual article retrieval
   - Validates complete article data structure

6. **GET /articles/:id returns 404 for non-existent article**
   - Tests error handling for missing articles

7. **GET /articles filters by feed_id**
   - Tests feed-specific article filtering
   - Validates query parameter handling

8. **PUT /articles/:id updates article**
   - Tests article modification
   - Validates language detection updates
   - Tests content modification tracking

9. **DELETE /articles/:id deletes article**
   - Tests article removal
   - Validates proper cleanup

10. **GET /articles with pagination**
    - Tests pagination across large article sets
    - Validates sorting and filtering

## RSS Polling Integration Tests

### `nytimes-polling.test.ts` - Real RSS Feed Processing
Tests the complete RSS feed polling workflow using The New York Times RSS feed as a reliable source.

#### Test Cases:
1. **NY Times RSS feed polling creates articles in database**
   - **Purpose**: Validates end-to-end RSS processing workflow
   - **Process**: 
     - Creates NY Times feed in database
     - Triggers manual polling operation
     - Validates articles are fetched, parsed, and stored
   - **Validations**:
     - Articles contain proper metadata (title, URL, timestamps)
     - Language detection is applied
     - All articles belong to the correct feed
     - URLs contain "nytimes.com" domain
     - Proper database relationships maintained

2. **NY Times RSS feed polling handles duplicate articles correctly**
   - **Purpose**: Ensures deduplication prevents duplicate articles
   - **Process**:
     - Runs initial polling to fetch articles
     - Records article count from first run
     - Runs second polling operation immediately
   - **Validations**:
     - Second poll finds 0 new articles
     - Database count remains unchanged
     - No duplicate entries created
     - System properly identifies existing articles by URL

3. **NY Times RSS feed polling detects English language correctly**
   - **Purpose**: Validates language detection accuracy on real content
   - **Process**:
     - Polls NY Times RSS feed
     - Analyzes language detection results across all articles
   - **Validations**:
     - At least 80% of articles detected as English
     - Language detection service properly integrated
     - Results are consistent with content source

### `polling-simple.test.ts` - Basic Polling Functionality
Tests fundamental polling operations with multiple feeds.

#### Test Cases:
1. **Polling creates articles in database with language detection**
   - **Purpose**: Tests basic polling workflow
   - **Process**: Creates test feeds and triggers polling
   - **Validations**: Articles created with language metadata

2. **Polling with multiple feeds creates articles for each feed**
   - **Purpose**: Ensures system can handle multiple RSS sources
   - **Process**: Creates multiple feeds, polls all simultaneously
   - **Validations**: Articles created for each feed source

### `polling-manual-review.test.ts` - Language Review System
Tests the manual language review flagging system.

#### Test Cases:
1. **Polling creates articles with proper manual review flagging**
   - **Purpose**: Tests automated quality control system
   - **Process**: Processes articles with ambiguous language content
   - **Validations**: Articles flagged for human review when language detection confidence is low

2. **Articles with sufficient content get automatic language detection**
   - **Purpose**: Validates automated processing for clear content
   - **Process**: Tests articles with clear, unambiguous language
   - **Validations**: Articles processed automatically without manual review flags

### `polling-integration.test.ts` - Advanced Polling Features
Tests the complete polling system with job management and filtering.

#### Test Cases:
1. **GET /polling/status returns current polling state**
   - Tests polling status endpoint
   - Validates system state tracking

2. **POST /polling/trigger executes manual poll with language detection**
   - Tests on-demand polling functionality
   - Validates language detection integration

3. **Language detection service integration works correctly**
   - Tests AI/LLM language detection service
   - Validates accuracy and performance

4. **Multiple feeds with different languages are detected correctly**
   - Tests multilingual content processing
   - Validates language detection across different sources

5. **Polling status reflects active feeds count correctly**
   - Tests feed counting and status reporting
   - Validates system health monitoring

6. **GET /polling/feeds/status shows feed status with language context**
   - Tests individual feed status reporting
   - Validates language-specific metrics

7. **Polling start/stop functionality works correctly**
   - Tests polling control system
   - Validates proper system state management

8. **Polling interval update works correctly**
   - Tests dynamic polling configuration
   - Validates runtime configuration changes

## Language Detection Tests

### `language-detection.test.ts` - AI Language Processing
Tests the AI-powered language detection system.

#### Test Cases:
1. **Language Detection Service Integration**
   - Tests LLM service connectivity
   - Validates language detection accuracy
   - Tests confidence scoring system
   - Validates supported language coverage

2. **Multilingual Content Processing**
   - Tests detection across different languages
   - Validates Unicode and special character handling
   - Tests mixed-language content processing

3. **Manual Review Flagging Logic**
   - Tests automatic quality control decisions
   - Validates confidence thresholds
   - Tests edge cases and ambiguous content

## Newsletter Generation Tests

### `newsletter.test.ts` - Email Newsletter Creation
Tests the newsletter generation system that creates HTML emails from articles.

#### Test Cases:

#### Newsletter Service Tests:
1. **generates LTR newsletter with sample data**
   - Tests left-to-right newsletter template
   - Validates HTML generation from article data
   - Tests MJML template processing

2. **generates RTL newsletter with sample data**  
   - Tests right-to-left newsletter template (for Arabic content)
   - Validates RTL layout and styling
   - Tests language-specific formatting

3. **detectLanguageDirection returns correct direction**
   - Tests automatic language direction detection
   - Validates LTR/RTL classification logic

#### Newsletter API Routes Tests:
4. **POST /newsletter/preview generates preview newsletter**
   - Tests preview functionality with sample data
   - Validates HTML output generation
   - Tests template rendering without real articles

5. **POST /newsletter/generate creates newsletter from custom data**
   - Tests custom newsletter creation
   - Validates input validation and processing
   - Tests dynamic article inclusion

6. **POST /newsletter/from-articles generates newsletter from database articles**
   - Tests newsletter generation from actual stored articles
   - Validates database integration
   - Tests article selection and formatting

7. **POST /newsletter/from-articles with RTL detection**
   - Tests automatic language direction detection
   - Validates RTL newsletter generation for Arabic content

8. **GET /newsletter/latest-articles returns recent articles**
   - Tests article fetching for newsletter creation
   - Validates article filtering and sorting

9. **GET /newsletter/latest-articles with language filter**
   - Tests language-specific article filtering
   - Validates multilingual newsletter support

10. **POST /newsletter/from-articles returns 404 for non-existent articles**
    - Tests error handling for missing articles
    - Validates proper HTTP error responses

11. **POST /newsletter/generate validates required fields**
    - Tests input validation
    - Validates required field enforcement

## Test Infrastructure

### Database Management
- **Setup**: Each test suite initializes a clean database
- **Cleanup**: Tests clean up after themselves to prevent interference
- **Isolation**: Tests run in isolation with separate database states

### External Dependencies
- **RSS Feeds**: Tests use real RSS feeds (NY Times) for integration testing
- **LLM Service**: Language detection tests use actual AI services
- **Email Templates**: Newsletter tests use real MJML templates

### Performance Considerations
- **Timeouts**: RSS polling tests have extended timeouts (30 seconds)
- **Parallel Execution**: Tests designed to run independently
- **Resource Management**: Proper cleanup of external connections

## Test Execution

### Running Tests
```bash
# Run all tests
npm test

# Run specific test suite
npm test -- src/tests/feeds.test.ts

# Run with specific pattern
npm test -- --grep "polling"

# Run in watch mode
npm test -- --watch
```

### Test Environment
- **Database**: SQLite in-memory for fast execution
- **Environment**: `NODE_ENV=test` for test-specific configurations
- **Mocking**: Minimal mocking to test real integrations

## Key Testing Principles

1. **Integration over Unit**: Tests focus on real workflows rather than isolated units
2. **Real Data**: Uses actual RSS feeds and content for realistic testing  
3. **End-to-End Validation**: Tests complete user workflows
4. **Error Handling**: Validates proper error responses and edge cases
5. **Performance**: Tests include timeout and performance validations
6. **Data Integrity**: Validates database relationships and constraints

## Common Test Patterns

### API Testing Pattern
```typescript
const response = await app.inject({
  method: "POST",
  url: "/endpoint",
  payload: testData
});

expect(response.statusCode).toBe(201);
const body = JSON.parse(response.body);
expect(body).toMatchObject(expectedShape);
```

### Database Validation Pattern
```typescript
const dbResult = await repository.findById(id);
expect(dbResult).toBeTruthy();
expect(dbResult.field).toBe(expectedValue);
```

### RSS Integration Pattern
```typescript
// Create feed
const feed = await createTestFeed();

// Trigger polling
const pollResponse = await triggerPolling();

// Validate results
expect(pollResponse.articles_found).toBeGreaterThan(0);
```

This comprehensive test suite ensures the GlobalNewsLetter application works correctly across all major functionality areas, from basic CRUD operations to complex multilingual RSS processing workflows.