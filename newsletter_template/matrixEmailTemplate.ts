// Define article + link types
export interface Article {
  title: string;
  description: string;
  url: string;
}

export interface QuickLink {
  text: string;
  url: string;
}

// Main generator function
export function generateMatrixEmail(
  featured: Article,
  articles: Article[],
  quickLinks: QuickLink[]
): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>MTRX Newsletter</title>
  <style>
    body {
      background: linear-gradient(180deg, #000000 0%, #001900 100%) !important;
      color: #00ff41;
      font-family: "Courier New", monospace;
      margin: 0;
      padding: 20px;
    }
    a {
      color: #00ff41;
      text-decoration: underline;
    }
    .container {
      max-width: 600px;
      margin: auto;
      padding: 20px;
      border: 1px solid #00ff41;
      border-radius: 8px;
      background: #000000;
    }
    h1, h2, h3 {
      color: #00ff41;
      text-align: center;
    }
    p {
      line-height: 1.6;
      font-size: 16px;
    }
    .divider {
      border-top: 1px dashed #00ff41;
      margin: 20px 0;
    }
    .footer {
      font-size: 12px;
      text-align: center;
      margin-top: 30px;
      color: #00aa33;
    }
    .btn {
      display: inline-block;
      background-color: #00ff41;
      color: #000;
      padding: 12px 20px;
      border-radius: 5px;
      text-decoration: none;
      font-weight: bold;
    }
  </style>
</head>
<body style="background-color:#000000; margin:0; padding:0;">
  <div class="container">
    <h1>Welcome to MTRX</h1>
    <p>
      You are now connected to the <strong>Matrix Network</strong>.  
      Every issue delivers the latest insights, decoded from the system.
    </p>

    <div class="divider"></div>

    <h2>🟢 Featured Drop</h2>
    <h3>${featured.title}</h3>
    <p>${featured.description}</p>
    <p><a href="${featured.url}" class="btn">Read Full Article</a></p>

    <div class="divider"></div>

    <h2>🟢 Latest Uploads</h2>
    <ul>
      ${articles
        .map(
          (a) => `
        <li>
          <strong><a href="${a.url}">${a.title}</a></strong><br>
          ${a.description}
        </li>
      `
        )
        .join("")}
    </ul>

    <div class="divider"></div>

    <h2>🔗 Quick Links</h2>
    <ul>
      ${quickLinks
        .map((l) => `<li><a href="${l.url}">${l.text}</a></li>`)
        .join("")}
    </ul>

    <div class="footer">
      You are receiving this transmission because you subscribed to MTRX.  
      <br>Unplug at any time by <a href="{{ unsubscribe_url }}">clicking here</a>.
    </div>
  </div>
</body>
</html>
  `;
}
