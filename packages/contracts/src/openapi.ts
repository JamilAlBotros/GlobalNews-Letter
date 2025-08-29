import { OpenAPIRegistry, OpenApiGeneratorV3, extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";
import { writeFileSync } from "node:fs";
import { z } from "zod";

extendZodWithOpenApi(z);
import { Feed, CreateFeedInput, UpdateFeedInput } from "./schemas/feed.js";
import { Article, CreateArticleInput, UpdateArticleInput } from "./schemas/article.js";
import { PaginationQuery, PaginatedResponse, HealthCheck, ReadinessCheck, ErrorResponse } from "./schemas/common.js";

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