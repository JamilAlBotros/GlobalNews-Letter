import { generateMatrixEmail, Article, QuickLink } from "./matrixEmailTemplate";

const featured: Article = {
  title: "The Simulation is Real",
  description: "A deep dive into AI and simulated worlds.",
  url: "https://example.com/featured"
};

const articles: Article[] = [
  {
    title: "Follow the White Rabbit",
    description: "Exploring hidden patterns in online systems.",
    url: "https://example.com/rabbit"
  },
  {
    title: "The Oracle Speaks",
    description: "Predictions on technology and markets.",
    url: "https://example.com/oracle"
  }
];

const quickLinks: QuickLink[] = [
  { text: "Matrix Code Archive", url: "https://example.com/archive" },
  { text: "Glitch Report", url: "https://example.com/glitch" },
  { text: "Upcoming Events", url: "https://example.com/events" }
];

// Generate HTML string
const emailHTML = generateMatrixEmail(featured, articles, quickLinks);

// You can now send emailHTML to Beehiiv API or save to file
console.log(emailHTML);
