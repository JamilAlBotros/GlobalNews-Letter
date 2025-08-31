const mjml2html = require('mjml');
const fs = require('fs');

let mjmlTemplate = fs.readFileSync('newsletter_template.mjml', 'utf8');

mjmlTemplate = mjmlTemplate
  .replace('{{TITLE}}', 'Weekly Tech Update')
  .replace('{{INTRO}}', 'Hello, here are the top stories this week...')
  .replace('{{LINK1_URL}}', 'https://example.com/article1')
  .replace('{{LINK1_TEXT}}', 'AI cracks financial models')
  // ...continue for other placeholders

const { html } = mjml2html(mjmlTemplate);
fs.writeFileSync('newsletter_final.html', html);
