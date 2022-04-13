require("isomorphic-fetch");
const express = require("express");
const app = express();
const cheerio = require("cheerio");
const prettier = require("prettier");
const { default: traverse } = require("@babel/traverse");
const globalsList = require("./globals.js");
app.set("json spaces", 2);

app.get("/:question", async (req, res) => {
  let results = await google(
    `site:stackoverflow.com javascript ${req.params.question.replace(
      /_/g,
      " "
    )}`
  );
  // return res.json(results);
  results = await getAnswer(results);
  if (req.query.json) {
    return res.json(results);
  }
  res.set({
    "Content-Type": "application/javascript",
  });
  if (!req.query.all) {
    results = [results[0]];
  }
  if (!req.query.bare) {
    if (req.query.all) {
      results = results.map((i) => `export ${i}`);
    } else {
      results = ["export " + results[0]];
    }
    return res.send(results.join("\n"));
  } else {
    return res.send(results.join("\n"));
  }
});
async function google(q) {
  let text = await fetch(
    `https://google.com/search?q=${encodeURIComponent(q)}`
  ).then((r) => r.text());
  const $ = cheerio.load(text);
  return $.root()
    .find('a[href^="/url"]')
    .toArray()
    .map((i) => i.attribs.href.split("q=")[1].split("&sa=")[0])
    .filter(
      (i) => !i.includes("support.google.com") && i.includes("/questions")
    );
}
async function getAnswer(searchResults) {
  if (searchResults.length < 1) {
    return [];
  }
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
    let html = await fetch(sr[idx]).then((r) => r.text());
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
      undeclared(require("babel-core").transform(func));
      return {
        error: false,
        code: prettier.format(func, { parser: "babel" }),
      };
    } catch (_) {
      console.log(_);
      return {
        error: true,
        message: _.message,
      };
    }
  }
  function undeclared(transformed) {
    let { ast } = transformed;
    let g = [...findGlobals(ast).keys()].filter(
      (i) => !globalsList.includes(i)
    );
    if (!g.length) {
      throw new Error("Function not pure: " + g.join(", "));
    } else {
      return transformed;
    }
    function findGlobals(ast) {
      const globals = new Map();
      traverse(ast, {
        // ReferencedIdentifier
        ReferencedIdentifier: (path) => {
          // skip if it refers to an existing variable
          const name = path.node.name;
          if (path.scope.hasBinding(name, true)) return;

          // check if arguments refers to a var, this shouldn't happen in strict mode
          if (name === "arguments") {
            if (isInFunctionDeclaration(path)) return;
          }

          // save global
          saveGlobal(path);
        },
        ThisExpression: (path) => {
          if (isInFunctionDeclaration(path)) return;
          saveGlobal(path, "this");
        },
      });
      return globals;
      function saveGlobal(path, name = path.node.name) {
        // init entry if needed
        if (!globals.has(name)) {
          globals.set(name, []);
        }
        // append ref
        const refsForName = globals.get(name);
        refsForName.push(path);
      }
      function isInFunctionDeclaration(path) {
        return getParents(path.parentPath).some(
          (parent) => parent.type === "FunctionDeclaration"
        );
      }
    }
  }
}

app.listen(process.env.PORT || 3000, () => {
  console.log(`App listening on *:${process.env.PORT || 3000} `);
});
