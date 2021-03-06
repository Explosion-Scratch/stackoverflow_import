# StackOverflow Import

StackOverflow question searcher, made by Explosion-Scratch.
Scrapes google for the question, then scrapes the StackOverflow
page for the code in that. Then it uses babel to validate
the code and make sure that there is one function that is pure
(requires no external variables). Then it returns that function.

It also falls back to up to the top 3 question pages.

## Usage:
```
/:question -> JavaScript function for that question
```

## Query parameters:
```
json=true -> Return a JSON list instead of code
all=true  -> Return all search results (export funcName(){}, exportFunc2())
bare=true -> Don't add "export " to the functions, just declare them
```
## Example Usage: 
```js
import chunkArray from "https://so.explosionscratc.repl.co/chunk_array"

console.log(chunkArray([1, 2, 3, 4, 5], 3))
```
