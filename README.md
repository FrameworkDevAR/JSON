# JSON

A JSON editor that runs in the browser: paste or drop a document and look at it
as text, as a tree or as a table, on one side or on two. It formats, compacts,
repairs, sorts, searches, queries and compares, and checks a document against a
JSON Schema. Everything stays in the browser, and comes back the way you left it.

**[Open JSON →](https://json.frameworkphp.com.ar/)**

## What it does

- **Three views** of the same document: the text, with its lines numbered, its
  parts colored, its brackets folding and its long lines wrapping; a tree that
  opens and closes, where keys and values are typed over in place; and a table
  for a list, a column for each value.
- **Three ways to write it out**: a line for each thing, in the one line, or
  the way a person would, with what fits in a line left in one.
- **Two panels**, to copy a document across, to put the result of a query
  beside what it was asked, and to compare the two, difference by difference.
  Either one can be given the whole page.
- **Repair**, for the text that is almost JSON: single quotes, keys without
  quotes, comments, commas missing or left over, brackets never closed, the
  `None` and `True` of Python, a call around it, a value per line.
- **Transform**, with a query written by hand or by a form that filters, sorts
  and picks. A query can be written in a small pipe language
  (`filter(.age > 18) | sort(.name) | pick(.name, .age)`), in JSONPath or in
  JavaScript.
- **JSON Schema**, to list every place where the document is not what the
  schema asks for.
- **CSV**, read as a list of objects and written from one.

## History

Every document that is worked on is kept in the history, the recent ones for a
while and the ones saved with a name for good. The address is that of the
documents being looked at, as `#h=<left>,<right>`, so the browser goes back and
forward through them. That address only means something in the browser that
holds the history.

## Links

A link can carry a document after its `#`, so opening it shows the document
right away. Nothing after the `#` is sent anywhere. A short one can be written
out, percent-encoded:

```
https://json.frameworkphp.com.ar/#json=<text>
```

A longer one is packed, as a JSON object that is gzipped and written in base64:

```
https://json.frameworkphp.com.ar/#z=<base64 of the gzip of the JSON>
```

The fields are `json`, and the optional `name`, `mode` (`text`, `tree` or
`table`), `right`, `rightName` and `compare`. [llms.txt](llms.txt) tells an LLM
how to write one.

**[Read about the Framework →](https://frameworkphp.com.ar/)**
