import OpenAI from "openai";
import { parse } from "node-html-parser";

const client = new OpenAI({
  apiKey: process.env.OPEN_AI_KEY as string,
});

const ollamaClient = new OpenAI({
  apiKey: process.env.OLLAMA_API_KEY as string,
  baseURL: "http://localhost:3000/api",
  defaultHeaders: {
    Authorization: `Bearer ${process.env.OLLAMA_API_KEY}`,
  },
});

interface Section {
  headline: string;
  content: string;
}

class Website {
  private _url: string;
  private _response: string;
  public sections: Section[];
  public text: string;

  private constructor(url: string) {
    this._url = url;
    this._response = "";
    this.sections = [];
    this.text = "";
  }

  static async create(url: string): Promise<Website> {
    const website = new Website(url);
    await website.fetchWebsite();
    website.parseSections();
    website.createText();
    return website;
  }
  private createText() {
    this.text = "Latest financial news headlines:\n\n";
    for (let i = 0; i < 10; i++) {
      this.text += `${i + 1}. ${this.sections[i]?.headline}\n`;
      this.text += `Summary: ${this.sections[i]?.content}\n\n`;
    }
  }

  private parseSections(): void {
    const root = parse(this._response);
    const sections: Section[] = [];
    const headings = root.querySelectorAll("h2, h3");
    for (const heading of headings) {
      let p = heading.nextElementSibling;
      while (p && p.tagName !== "P") {
        p = p.nextElementSibling;
      }
      if (p && p.tagName === "P") {
        sections.push({
          headline: heading.text.trim(),
          content: p.text.trim(),
        });
      }
    }
    this.sections = sections;
  }

  private async fetchWebsite() {
    const response = await fetch(this._url);
    if (!response.ok) {
      throw new Error(`Failed to fetch: ${response.statusText}`);
    }
    this._response = await response.text();
  }
}

const systemPrompt = `You are a veteran stock market and finance expert with 50+ years of experience helping investors make safe, steady gains. Your audience is beginners with small amounts to invest (around $100). 

**Response Format:**
1. Start with "The News Snapshot:" - Write 3-4 lines summarizing the key financial developments from the provided headlines and summaries, showing you understand the current market situation, start the write up for this with today in the news we see that...

2. Give specific stock advice based on the news:
  - What to avoid and why
  - 2-3 specific stock recommendations with ticker symbols
  - Focus only on safe, dividend-paying stocks or clear beneficiaries from the news

3. End with "The big picture:" - One sentence explaining the overall market condition

4. Close with "Your game plan:" - Simple, actionable advice for their $100 to show how to split it

**Tone & Style:**
- Talk like a knowledgeable but friendly Wall Street professional advising a beginner
- Keep it under 200 words total
- Use simple language, no complex jargon
- Be direct and practical
- Focus on capital preservation over quick gains
- Always relate advice directly to the news headlines provided

**Key Rules:**
- Only recommend established, safe stocks
- Always explain WHY based on the news
- No speculative or meme stocks
- Emphasize learning over quick profits`;

function userPromptFor(website: Website) {
  let userPrompt = `You are looking at a website with financial news. \n The contents of this website are as follows; please provide your investment advice for a beginner with $100. Because it includes finance news or trend, let the advice be based on these too.`;
  userPrompt += `\n\n${website.text}`;
  return userPrompt;
}

async function getAdvice(url: string) {
  const website = await Website.create(url);
  try {
    const response = await ollamaClient.chat.completions.create({
      model: "llama3.2:latest",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPromptFor(website) },
      ],
    });

    return response.choices[0]?.message.content;
  } catch (error) {
    console.error("Error fetching advice:", error);
  }
}

await getAdvice("https://finance.yahoo.com/topic/latest-news/").then(
  (advice) => {
    console.log(advice);
  },
);
