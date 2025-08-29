````markdown
# News API Documentation

## Endpoints

News API has 2 main endpoints and 1 minor endpoint for retrieving sources.

* **/v2/everything**: Search every article published by over 150,000 different sources in the last 5 years. This endpoint is ideal for news analysis and article discovery.
* **/v2/top-headlines**: Returns breaking news headlines for countries, categories, and singular publishers. This is perfect for news tickers or live news feeds.
* **/v2/top-headlines/sources**: Returns information (including name, description, and category) about the most notable sources available for top headlines.

---
## Installation

```bash
$ npm install newsapi --save
````

-----

## Usage

### Node.js Client

```javascript
const NewsAPI = require('newsapi');
const newsapi = new NewsAPI('YOUR_API_KEY');

// To query /v2/top-headlines
// All options are optional, but you need to include at least one of them.
newsapi.v2.topHeadlines({
  sources: 'bbc-news,the-verge',
  q: 'bitcoin',
  category: 'business',
  language: 'en',
  country: 'us'
}).then(response => {
  console.log(response);
  /*
    {
      status: "ok",
      articles: [...]
    }
  */
});

// To query /v2/everything
// You must include at least one q, source, or domain.
newsapi.v2.everything({
  q: 'bitcoin',
  sources: 'bbc-news,the-verge',
  domains: 'bbc.co.uk, techcrunch.com',
  from: '2025-07-24',
  to: '2025-08-24',
  language: 'en',
  sortBy: 'relevancy',
  page: 2
}).then(response => {
  console.log(response);
  /*
    {
      status: "ok",
      articles: [...]
    }
  */
});

// To query /v2/top-headlines/sources
// All options are optional.
newsapi.v2.sources({
  category: 'technology',
  language: 'en',
  country: 'us'
}).then(response => {
  console.log(response);
  /*
    {
      status: "ok",
      sources: [...]
    }
  */
});
```

-----

## Endpoint Reference

### Everything (`/v2/everything`)

Search through millions of articles from over 150,000 sources.

#### Definition

`GET https://newsapi.org/v2/everything`

#### Example Request

This example finds all articles that mention "Apple" published today, sorted by popularity.

```bash
curl [https://newsapi.org/v2/everything](https://newsapi.org/v2/everything) -G \
    -d q=Apple \
    -d from=2025-08-24 \
    -d sortBy=popularity \
    -d apiKey=YOUR_API_KEY
```

#### Example Response

```json
{
  "status": "ok",
  "totalResults": 517,
  "articles": [
    {
      "source": {
        "id": null,
        "name": "MacRumors"
      },
      "author": "Joe Rossignol",
      "title": "iPhone 17 Pro Coming Soon With These 12 New Features",
      "description": "Apple's iPhone 17 Pro and iPhone 17 Pro Max should be unveiled in a few more weeks, and there are plenty of rumors about the devices...",
      "url": "[https://www.macrumors.com/2025/08/24/iphone-17-pro-next-month/](https://www.macrumors.com/2025/08/24/iphone-17-pro-next-month/)",
      "urlToImage": "[https://images.macrumors.com/t/pxdcoJyi0XOct0uaY0E8tZkHBy4=/2500x/article-new/2025/07/iPhone-17-Pro-on-Desk-Centered-1.jpg](https://images.macrumors.com/t/pxdcoJyi0XOct0uaY0E8tZkHBy4=/2500x/article-new/2025/07/iPhone-17-Pro-on-Desk-Centered-1.jpg)",
      "publishedAt": "2025-08-24T13:00:00Z",
      "content": "Apple's iPhone 17 Pro and iPhone 17 Pro Max should be unveiled in a few more weeks, and there are plenty of rumors about the devices. In his Power On newsletter today, Bloomberg's Mark Gurman corrob… [+2902 chars]"
    }
    // ... more articles
  ]
}
```

### Top Headlines (`/v2/top-headlines`)

This endpoint provides live top and breaking headlines for a country, category, or source.

#### Request Parameters

  * `apiKey` (required): Your API key.
  * `country`: The 2-letter ISO 3166-1 code of the country (e.g., `us`, `gb`). *Cannot be mixed with `sources` param.*
  * `category`: The category you want headlines for (e.g., `business`, `technology`). *Cannot be mixed with `sources` param.*
  * `sources`: A comma-separated string of identifiers for news sources (e.g., `bbc-news`). *Cannot be mixed with `country` or `category`.*
  * `q`: Keywords or a phrase to search for.
  * `pageSize` (int): The number of results to return per page (Default: 20, Max: 100).
  * `page` (int): Use this to page through the results.

#### Example Request

Get the current top headlines in the US.

```bash
curl [https://newsapi.org/v2/top-headlines](https://newsapi.org/v2/top-headlines) -G \
    -d country=us \
    -d apiKey=YOUR_API_KEY
```

#### Example Response

```json
{
  "status": "ok",
  "totalResults": 37,
  "articles": [
    {
      "source": {
        "id": "the-washington-post",
        "name": "The Washington Post"
      },
      "author": "Daniel Wu",
      "title": "Trump threatens to send National Guard troops to Baltimore - The Washington Post",
      "description": "Trump and Gov. Wes Moore (D) have traded barbs over Maryland’s largest city in recent days as the president’s intervention in D.C. escalates.",
      "url": "[https://www.washingtonpost.com/dc-md-va/2025/08/24/trump-baltimore-troops-wes-moore/](https://www.washingtonpost.com/dc-md-va/2025/08/24/trump-baltimore-troops-wes-moore/)",
      "urlToImage": "[https://www.washingtonpost.com/wp-apps/imrs.php?src=https://arc-anglerfish-washpost-prod-washpost.s3.amazonaws.com/public/CKRC7WTXPPOFITNL42KFYPJZCA_size-normalized.jpg&w=1440](https://www.washingtonpost.com/wp-apps/imrs.php?src=https://arc-anglerfish-washpost-prod-washpost.s3.amazonaws.com/public/CKRC7WTXPPOFITNL42KFYPJZCA_size-normalized.jpg&w=1440)",
      "publishedAt": "2025-08-24T18:38:09Z",
      "content": "President Donald Trump threatened to send troops to Baltimore and called the city out of control and crime ridden in a Sunday morning Truth Social post responding to Maryland Gov. Wes Moores (D) invi… [+88 chars]"
    }
    // ... more articles
  ]
}
```

### Response Object Structure

The `articles` array in both `/everything` and `/top-headlines` contains objects with the following structure:

  * `source` (object): Contains the `id` and `name` of the source.
  * `author` (string): The author of the article.
  * `title` (string): The headline or title of the article.
  * `description` (string): A description or snippet from the article.
  * `url` (string): The direct URL to the article.
  * `urlToImage` (string): The URL to a relevant image for the article.
  * `publishedAt` (string): The date and time the article was published, in UTC.
  * `content` (string): The unformatted content of the article, truncated to 200 characters.

<!-- end list -->

```
```