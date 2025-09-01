import { OpenAPIRegistry, OpenApiGeneratorV3, extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";
import { writeFileSync } from "node:fs";
import { z } from "zod";

extendZodWithOpenApi(z);
import { Feed, CreateFeedInput, UpdateFeedInput } from "./schemas/feed.js";
import { Article, CreateArticleInput, UpdateArticleInput } from "./schemas/article.js";
import { PaginationQuery, PaginatedResponse, HealthCheck, ReadinessCheck, ErrorResponse } from "./schemas/common.js";
import { 
  TranslationRequestInput, TranslationResponse,
  SummarizationRequestInput, SummarizationResponse,
  LanguageDetectionRequestInput, LanguageDetectionResponse,
  CategorizationRequestInput, CategorizationResponse,
  QualityAssessmentRequestInput, QualityAssessmentResponse,
  BatchTranslationRequestInput, BatchTranslationResponse,
  LLMHealthCheckResponse, LLMErrorResponse
} from "./schemas/llm.js";

const registry = new OpenAPIRegistry();

registry.register("Feed", Feed);
registry.register("CreateFeedInput", CreateFeedInput);
registry.register("UpdateFeedInput", UpdateFeedInput);
registry.register("Article", Article);
registry.register("CreateArticleInput", CreateArticleInput);
registry.register("UpdateArticleInput", UpdateArticleInput);
registry.register("PaginationQuery", PaginationQuery);
registry.register("PaginatedFeedsResponse", PaginatedResponse(Feed));
registry.register("PaginatedArticlesResponse", PaginatedResponse(Article));
registry.register("HealthCheck", HealthCheck);
registry.register("ReadinessCheck", ReadinessCheck);
registry.register("ErrorResponse", ErrorResponse);

// LLM schemas
registry.register("TranslationRequestInput", TranslationRequestInput);
registry.register("TranslationResponse", TranslationResponse);
registry.register("SummarizationRequestInput", SummarizationRequestInput);
registry.register("SummarizationResponse", SummarizationResponse);
registry.register("LanguageDetectionRequestInput", LanguageDetectionRequestInput);
registry.register("LanguageDetectionResponse", LanguageDetectionResponse);
registry.register("CategorizationRequestInput", CategorizationRequestInput);
registry.register("CategorizationResponse", CategorizationResponse);
registry.register("QualityAssessmentRequestInput", QualityAssessmentRequestInput);
registry.register("QualityAssessmentResponse", QualityAssessmentResponse);
registry.register("BatchTranslationRequestInput", BatchTranslationRequestInput);
registry.register("BatchTranslationResponse", BatchTranslationResponse);
registry.register("LLMHealthCheckResponse", LLMHealthCheckResponse);
registry.register("LLMErrorResponse", LLMErrorResponse);

registry.registerPath({
  method: "get",
  path: "/healthz",
  responses: {
    200: {
      description: "Health check",
      content: { "application/json": { schema: HealthCheck } }
    }
  }
});

registry.registerPath({
  method: "get",
  path: "/readyz",
  responses: {
    200: {
      description: "Readiness check",
      content: { "application/json": { schema: ReadinessCheck } }
    },
    503: {
      description: "Service unavailable",
      content: { "application/problem+json": { schema: ErrorResponse } }
    }
  }
});

registry.registerPath({
  method: "get",
  path: "/feeds",
  request: {
    query: PaginationQuery
  },
  responses: {
    200: {
      description: "List of feeds",
      content: { "application/json": { schema: PaginatedResponse(Feed) } }
    },
    400: {
      description: "Bad request",
      content: { "application/problem+json": { schema: ErrorResponse } }
    }
  }
});

registry.registerPath({
  method: "post",
  path: "/feeds",
  request: {
    body: {
      content: { "application/json": { schema: CreateFeedInput } }
    }
  },
  responses: {
    201: {
      description: "Feed created",
      content: { "application/json": { schema: Feed } }
    },
    400: {
      description: "Bad request",
      content: { "application/problem+json": { schema: ErrorResponse } }
    },
    409: {
      description: "Conflict - feed already exists",
      content: { "application/problem+json": { schema: ErrorResponse } }
    }
  }
});

registry.registerPath({
  method: "get",
  path: "/feeds/{id}",
  request: {
    params: z.object({ id: z.string().uuid() })
  },
  responses: {
    200: {
      description: "Feed details",
      content: { "application/json": { schema: Feed } }
    },
    404: {
      description: "Feed not found",
      content: { "application/problem+json": { schema: ErrorResponse } }
    }
  }
});

registry.registerPath({
  method: "put",
  path: "/feeds/{id}",
  request: {
    params: z.object({ id: z.string().uuid() }),
    body: {
      content: { "application/json": { schema: UpdateFeedInput } }
    }
  },
  responses: {
    200: {
      description: "Feed updated",
      content: { "application/json": { schema: Feed } }
    },
    404: {
      description: "Feed not found",
      content: { "application/problem+json": { schema: ErrorResponse } }
    },
    400: {
      description: "Bad request",
      content: { "application/problem+json": { schema: ErrorResponse } }
    }
  }
});

registry.registerPath({
  method: "delete",
  path: "/feeds/{id}",
  request: {
    params: z.object({ id: z.string().uuid() })
  },
  responses: {
    204: {
      description: "Feed deleted"
    },
    404: {
      description: "Feed not found",
      content: { "application/problem+json": { schema: ErrorResponse } }
    }
  }
});

registry.registerPath({
  method: "get",
  path: "/articles",
  request: {
    query: PaginationQuery.extend({
      feed_id: z.string().uuid().optional()
    })
  },
  responses: {
    200: {
      description: "List of articles",
      content: { "application/json": { schema: PaginatedResponse(Article) } }
    },
    400: {
      description: "Bad request",
      content: { "application/problem+json": { schema: ErrorResponse } }
    }
  }
});

registry.registerPath({
  method: "post",
  path: "/articles",
  request: {
    body: {
      content: { "application/json": { schema: CreateArticleInput } }
    }
  },
  responses: {
    201: {
      description: "Article created",
      content: { "application/json": { schema: Article } }
    },
    400: {
      description: "Bad request",
      content: { "application/problem+json": { schema: ErrorResponse } }
    },
    409: {
      description: "Conflict - article already exists",
      content: { "application/problem+json": { schema: ErrorResponse } }
    }
  }
});

registry.registerPath({
  method: "get",
  path: "/articles/{id}",
  request: {
    params: z.object({ id: z.string().uuid() })
  },
  responses: {
    200: {
      description: "Article details",
      content: { "application/json": { schema: Article } }
    },
    404: {
      description: "Article not found",
      content: { "application/problem+json": { schema: ErrorResponse } }
    }
  }
});

// LLM API endpoints
registry.registerPath({
  method: "post",
  path: "/llm/translate",
  request: {
    body: {
      content: { "application/json": { schema: TranslationRequestInput } }
    }
  },
  responses: {
    200: {
      description: "Translation completed",
      content: { "application/json": { schema: TranslationResponse } }
    },
    400: {
      description: "Bad request",
      content: { "application/problem+json": { schema: LLMErrorResponse } }
    },
    500: {
      description: "Translation failed",
      content: { "application/problem+json": { schema: LLMErrorResponse } }
    }
  }
});

registry.registerPath({
  method: "post",
  path: "/llm/translate/batch",
  request: {
    body: {
      content: { "application/json": { schema: BatchTranslationRequestInput } }
    }
  },
  responses: {
    200: {
      description: "Batch translation completed",
      content: { "application/json": { schema: BatchTranslationResponse } }
    },
    400: {
      description: "Bad request",
      content: { "application/problem+json": { schema: LLMErrorResponse } }
    },
    500: {
      description: "Batch translation failed",
      content: { "application/problem+json": { schema: LLMErrorResponse } }
    }
  }
});

registry.registerPath({
  method: "post",
  path: "/llm/summarize",
  request: {
    body: {
      content: { "application/json": { schema: SummarizationRequestInput } }
    }
  },
  responses: {
    200: {
      description: "Summarization completed",
      content: { "application/json": { schema: SummarizationResponse } }
    },
    400: {
      description: "Bad request",
      content: { "application/problem+json": { schema: LLMErrorResponse } }
    },
    500: {
      description: "Summarization failed",
      content: { "application/problem+json": { schema: LLMErrorResponse } }
    }
  }
});

registry.registerPath({
  method: "post",
  path: "/llm/detect-language",
  request: {
    body: {
      content: { "application/json": { schema: LanguageDetectionRequestInput } }
    }
  },
  responses: {
    200: {
      description: "Language detection completed",
      content: { "application/json": { schema: LanguageDetectionResponse } }
    },
    400: {
      description: "Bad request",
      content: { "application/problem+json": { schema: LLMErrorResponse } }
    },
    500: {
      description: "Language detection failed",
      content: { "application/problem+json": { schema: LLMErrorResponse } }
    }
  }
});

registry.registerPath({
  method: "post",
  path: "/llm/categorize",
  request: {
    body: {
      content: { "application/json": { schema: CategorizationRequestInput } }
    }
  },
  responses: {
    200: {
      description: "Content categorization completed",
      content: { "application/json": { schema: CategorizationResponse } }
    },
    400: {
      description: "Bad request",
      content: { "application/problem+json": { schema: LLMErrorResponse } }
    },
    500: {
      description: "Categorization failed",
      content: { "application/problem+json": { schema: LLMErrorResponse } }
    }
  }
});

registry.registerPath({
  method: "post",
  path: "/llm/assess-quality",
  request: {
    body: {
      content: { "application/json": { schema: QualityAssessmentRequestInput } }
    }
  },
  responses: {
    200: {
      description: "Content quality assessment completed",
      content: { "application/json": { schema: QualityAssessmentResponse } }
    },
    400: {
      description: "Bad request",
      content: { "application/problem+json": { schema: LLMErrorResponse } }
    },
    500: {
      description: "Quality assessment failed",
      content: { "application/problem+json": { schema: LLMErrorResponse } }
    }
  }
});

registry.registerPath({
  method: "get",
  path: "/llm/health",
  responses: {
    200: {
      description: "LLM service health status",
      content: { "application/json": { schema: LLMHealthCheckResponse } }
    },
    503: {
      description: "LLM service unhealthy",
      content: { "application/json": { schema: LLMHealthCheckResponse } }
    }
  }
});

const generator = new OpenApiGeneratorV3(registry.definitions);

const document = generator.generateDocument({
  openapi: "3.0.3",
  info: {
    title: "GlobalNews Letter MVP API",
    version: "0.1.0",
    description: "Simple news feed aggregation API"
  },
  servers: [
    { url: "http://localhost:3333", description: "Local development" }
  ]
});

writeFileSync(new URL("../openapi.json", import.meta.url), JSON.stringify(document, null, 2));
console.log("Generated openapi.json");