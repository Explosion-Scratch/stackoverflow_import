require("isomorphic-fetch");
const express = require("express");
const app = express();
const cheerio = require("cheerio");
const prettier = require("prettier");
app.set("json spaces", 2);

app.get("/:question", async (req, res) => {
  return res.json({});
  let q = req.params.question.trim().toLowerCase().replace(/_/g, " ");
  const searchResults = await fetch(
    `https://api.stackexchange.com/2.3/search?${new URLSearchParams({
      // https://api.stackexchange.com/search?order=desc&sort=votes&tagged=javascript&site=stackoverflow&intitle=test
      order: "desc",
      sort: "votes",
      tagged: `javascript;npm;react;vue;js`,
      site: "stackoverflow",
      intitle: q,
    }).toString()}`
  ).then((r) => r.json());
  console.log(searchResults, q);
  if (searchResults.items.length < 1) {
    return res.json([]);
  }
  res.json(await getAnswer(searchResults.items));
});
google("test").then(console.log);
async function google(q) {
  let text = await fetch(
    `https://google.com/search?q=${encodeURIComponent(q)}`
  ).then((r) => r.text());
  const $ = cheerio.load(text);
  return $.root()
    .find('a[href^="/url"]')
    .toArray()
    .map((i) => i.attribs.href.split("q=")[1].split("&sa=")[0]);
}
async function getAnswer(searchResults) {
  for (let index in searchResults) {
    console.log("Searching index %o", index);
    let result = await ga(index, searchResults);
    if (result.length) {
      return result;
    } else {
      console.log("Throwing away result: ", result);
    }
  }
  return [];

  async function ga(idx, sr) {
    let html = await fetch(sr[idx].link).then((r) => r.text());
    const $ = cheerio.load(html);
    let codes = $("body")
      .find("pre")
      .toArray()
      .map((i) => $(i).text());
    return codes
      .map((i) => transform(i))
      .filter((i) => {
        if (i.error) {
          console.log(i, i.error);
          return false;
        }
        return true;
      })
      .map((i) => i.code);
  }
  function transform(string) {
    let transformed;
    try {
      transformed = require("babel-core").transform(string);
    } catch (e) {
      return {
        error: true,
        message: e.toString(),
      };
    }
    let ast = transformed.ast.program.body.find(
      (i) =>
        i.type === "FunctionDeclaration" ||
        (i.type === "VariableDeclaration" &&
          i.declarations[0]?.init?.type === "ArrowFunctionExpression")
    );
    if (!ast) {
      return {
        error: true,
        message: "No function found",
      };
    }
    let func = string.slice(ast.start, ast.end);
    if (!func) {
      return {
        error: true,
        message: "No function",
        func,
      };
    }
    try {
      require("babel-core").transform(func, {
        plugins: ["undeclared-variables-check"],
      });
      return {
        error: false,
        code: prettier.format(func, { parser: "babel" }),
      };
    } catch (_) {
      return {
        error: true,
        message: "Function not pure",
      };
    }
  }
}

app.listen(process.env.PORT || 3000, () => {
  console.log(`App listening on *:${process.env.PORT || 3000} `);
});
