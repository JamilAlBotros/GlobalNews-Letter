import { FastifyInstance } from "fastify";
import { z } from "zod";

// Zod schemas for validation
const NewsletterItemSchema = z.object({
  id: z.string(),
  type: z.enum(['article', 'text']),
  content: z.union([
    z.object({
      id: z.string(),
      title: z.string(),
      url: z.string(),
      description: z.string().nullable(),
      feed_name: z.string(),
      detected_language: z.string().nullable(),
      published_at: z.string(),
      created_at: z.string()
    }),
    z.object({
      text: z.string(),
      htmlContent: z.string().optional()
    })
  ]),
  order: z.number()
});

const ExportRequestSchema = z.object({
  title: z.string(),
  items: z.array(NewsletterItemSchema)
});

export async function newsletterExportRoutes(app: FastifyInstance): Promise<void> {
  
  // Export newsletter as HTML
  app.post("/newsletter/export", async (request, reply) => {
    try {
      const input = ExportRequestSchema.parse(request.body);

      const html = generateNewsletterHTML(input.title, input.items);
      
      return reply
        .header('Content-Type', 'text/html; charset=utf-8')
        .header('Content-Disposition', `attachment; filename="${input.title.replace(/\s+/g, '-').toLowerCase()}-newsletter.html"`)
        .send(html);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return reply.code(400).type("application/problem+json").send({
          type: "about:blank",
          title: "Validation Error",
          status: 400,
          detail: error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', '),
          instance: request.url
        });
      }

      return reply.code(500).type("application/problem+json").send({
        type: "about:blank",
        title: "Export Error",
        status: 500,
        detail: error.message,
        instance: request.url
      });
    }
  });

  // Preview newsletter as HTML (without download headers)
  app.post("/newsletter/preview-html", async (request, reply) => {
    try {
      const input = ExportRequestSchema.parse(request.body);

      const html = generateNewsletterHTML(input.title, input.items);
      
      return reply
        .header('Content-Type', 'text/html; charset=utf-8')
        .send(html);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return reply.code(400).type("application/problem+json").send({
          type: "about:blank",
          title: "Validation Error",
          status: 400,
          detail: error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', '),
          instance: request.url
        });
      }

      return reply.code(500).type("application/problem+json").send({
        type: "about:blank",
        title: "Preview Error",
        status: 500,
        detail: error.message,
        instance: request.url
      });
    }
  });
}

function generateNewsletterHTML(title: string, items: any[]): string {
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const itemsHTML = items
    .sort((a, b) => a.order - b.order)
    .map(item => {
      if (item.type === 'article') {
        const article = item.content;
        return `
          <div style="margin-bottom: 32px; padding: 24px; background-color: #ffffff; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
            <h2 style="margin: 0 0 16px 0; font-size: 24px; font-weight: 700; color: #1f2937; line-height: 1.3;">
              ${escapeHtml(article.title)}
            </h2>
            ${article.description ? `
              <p style="margin: 0 0 16px 0; font-size: 16px; color: #4b5563; line-height: 1.6;">
                ${escapeHtml(article.description)}
              </p>
            ` : ''}
            <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 20px;">
              <a href="${article.url}" 
                 style="display: inline-flex; align-items: center; color: #3b82f6; text-decoration: none; font-weight: 600; font-size: 14px;"
                 target="_blank" rel="noopener noreferrer">
                Read Full Article →
              </a>
              <div style="font-size: 14px; color: #6b7280;">
                ${formatDate(article.published_at)}
                ${article.feed_name ? ` • ${escapeHtml(article.feed_name)}` : ''}
              </div>
            </div>
          </div>
        `;
      } else {
        const textContent = item.content;
        const htmlContent = textContent.htmlContent || textContent.text.replace(/\n/g, '<br>');
        return `
          <div style="margin-bottom: 32px; font-size: 16px; color: #374151; line-height: 1.7;">
            ${htmlContent}
          </div>
        `;
      }
    })
    .join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <title>${escapeHtml(title)}</title>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
        
        * {
            box-sizing: border-box;
        }
        
        body {
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            margin: 0;
            padding: 0;
            background-color: #f8fafc;
            line-height: 1.6;
            color: #374151;
        }
        
        .container {
            max-width: 680px;
            margin: 0 auto;
            background-color: #ffffff;
            box-shadow: 0 4px 6px rgba(0,0,0,0.07);
        }
        
        .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            padding: 40px 32px;
            text-align: center;
        }
        
        .header h1 {
            color: #ffffff;
            font-size: 32px;
            font-weight: 700;
            margin: 0;
            text-shadow: 0 2px 4px rgba(0,0,0,0.2);
        }
        
        .content {
            padding: 40px 32px;
        }
        
        .footer {
            background-color: #f8fafc;
            padding: 32px;
            text-align: center;
            border-top: 1px solid #e5e7eb;
        }
        
        .footer p {
            margin: 0;
            color: #6b7280;
            font-size: 14px;
        }
        
        .generation-info {
            margin-top: 16px;
            padding-top: 16px;
            border-top: 1px solid #e5e7eb;
            font-size: 12px;
            color: #9ca3af;
        }
        
        @media (max-width: 640px) {
            .container {
                margin: 0;
                box-shadow: none;
            }
            
            .header {
                padding: 24px 20px;
            }
            
            .header h1 {
                font-size: 24px;
            }
            
            .content {
                padding: 24px 20px;
            }
            
            .footer {
                padding: 24px 20px;
            }
            
            div[style*="padding: 24px"] {
                padding: 16px !important;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>${escapeHtml(title)}</h1>
        </div>
        
        <div class="content">
            ${itemsHTML}
        </div>
        
        <div class="footer">
            <p>Generated with GlobalNews Letter</p>
            <div class="generation-info">
                Generated on ${new Date().toLocaleDateString('en-US', { 
                  year: 'numeric', 
                  month: 'long', 
                  day: 'numeric', 
                  hour: '2-digit', 
                  minute: '2-digit' 
                })}
            </div>
        </div>
    </div>
</body>
</html>`;
}

function escapeHtml(text: string): string {
  const div = { innerHTML: '' } as any;
  div.textContent = text;
  return div.innerHTML || text.replace(/[&<>"']/g, (match: string) => {
    const htmlEscapes: { [key: string]: string } = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    };
    return htmlEscapes[match];
  });
}