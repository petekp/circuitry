#!/usr/bin/env node
import { createRequire as __circuitCreateRequire } from 'node:module';
const require = __circuitCreateRequire(import.meta.url);
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __require = /* @__PURE__ */ ((x) => typeof require !== "undefined" ? require : typeof Proxy !== "undefined" ? new Proxy(x, {
  get: (a, b) => (typeof require !== "undefined" ? require : a)[b]
}) : x)(function(x) {
  if (typeof require !== "undefined") return require.apply(this, arguments);
  throw Error('Dynamic require of "' + x + '" is not supported');
});
var __commonJS = (cb, mod) => function __require2() {
  return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// node_modules/yaml/dist/nodes/identity.js
var require_identity = __commonJS({
  "node_modules/yaml/dist/nodes/identity.js"(exports) {
    "use strict";
    var ALIAS = Symbol.for("yaml.alias");
    var DOC = Symbol.for("yaml.document");
    var MAP = Symbol.for("yaml.map");
    var PAIR = Symbol.for("yaml.pair");
    var SCALAR = Symbol.for("yaml.scalar");
    var SEQ = Symbol.for("yaml.seq");
    var NODE_TYPE = Symbol.for("yaml.node.type");
    var isAlias = (node) => !!node && typeof node === "object" && node[NODE_TYPE] === ALIAS;
    var isDocument = (node) => !!node && typeof node === "object" && node[NODE_TYPE] === DOC;
    var isMap = (node) => !!node && typeof node === "object" && node[NODE_TYPE] === MAP;
    var isPair = (node) => !!node && typeof node === "object" && node[NODE_TYPE] === PAIR;
    var isScalar = (node) => !!node && typeof node === "object" && node[NODE_TYPE] === SCALAR;
    var isSeq = (node) => !!node && typeof node === "object" && node[NODE_TYPE] === SEQ;
    function isCollection(node) {
      if (node && typeof node === "object")
        switch (node[NODE_TYPE]) {
          case MAP:
          case SEQ:
            return true;
        }
      return false;
    }
    function isNode(node) {
      if (node && typeof node === "object")
        switch (node[NODE_TYPE]) {
          case ALIAS:
          case MAP:
          case SCALAR:
          case SEQ:
            return true;
        }
      return false;
    }
    var hasAnchor = (node) => (isScalar(node) || isCollection(node)) && !!node.anchor;
    exports.ALIAS = ALIAS;
    exports.DOC = DOC;
    exports.MAP = MAP;
    exports.NODE_TYPE = NODE_TYPE;
    exports.PAIR = PAIR;
    exports.SCALAR = SCALAR;
    exports.SEQ = SEQ;
    exports.hasAnchor = hasAnchor;
    exports.isAlias = isAlias;
    exports.isCollection = isCollection;
    exports.isDocument = isDocument;
    exports.isMap = isMap;
    exports.isNode = isNode;
    exports.isPair = isPair;
    exports.isScalar = isScalar;
    exports.isSeq = isSeq;
  }
});

// node_modules/yaml/dist/visit.js
var require_visit = __commonJS({
  "node_modules/yaml/dist/visit.js"(exports) {
    "use strict";
    var identity = require_identity();
    var BREAK = Symbol("break visit");
    var SKIP = Symbol("skip children");
    var REMOVE = Symbol("remove node");
    function visit(node, visitor) {
      const visitor_ = initVisitor(visitor);
      if (identity.isDocument(node)) {
        const cd = visit_(null, node.contents, visitor_, Object.freeze([node]));
        if (cd === REMOVE)
          node.contents = null;
      } else
        visit_(null, node, visitor_, Object.freeze([]));
    }
    visit.BREAK = BREAK;
    visit.SKIP = SKIP;
    visit.REMOVE = REMOVE;
    function visit_(key, node, visitor, path) {
      const ctrl = callVisitor(key, node, visitor, path);
      if (identity.isNode(ctrl) || identity.isPair(ctrl)) {
        replaceNode(key, path, ctrl);
        return visit_(key, ctrl, visitor, path);
      }
      if (typeof ctrl !== "symbol") {
        if (identity.isCollection(node)) {
          path = Object.freeze(path.concat(node));
          for (let i = 0; i < node.items.length; ++i) {
            const ci = visit_(i, node.items[i], visitor, path);
            if (typeof ci === "number")
              i = ci - 1;
            else if (ci === BREAK)
              return BREAK;
            else if (ci === REMOVE) {
              node.items.splice(i, 1);
              i -= 1;
            }
          }
        } else if (identity.isPair(node)) {
          path = Object.freeze(path.concat(node));
          const ck = visit_("key", node.key, visitor, path);
          if (ck === BREAK)
            return BREAK;
          else if (ck === REMOVE)
            node.key = null;
          const cv = visit_("value", node.value, visitor, path);
          if (cv === BREAK)
            return BREAK;
          else if (cv === REMOVE)
            node.value = null;
        }
      }
      return ctrl;
    }
    async function visitAsync(node, visitor) {
      const visitor_ = initVisitor(visitor);
      if (identity.isDocument(node)) {
        const cd = await visitAsync_(null, node.contents, visitor_, Object.freeze([node]));
        if (cd === REMOVE)
          node.contents = null;
      } else
        await visitAsync_(null, node, visitor_, Object.freeze([]));
    }
    visitAsync.BREAK = BREAK;
    visitAsync.SKIP = SKIP;
    visitAsync.REMOVE = REMOVE;
    async function visitAsync_(key, node, visitor, path) {
      const ctrl = await callVisitor(key, node, visitor, path);
      if (identity.isNode(ctrl) || identity.isPair(ctrl)) {
        replaceNode(key, path, ctrl);
        return visitAsync_(key, ctrl, visitor, path);
      }
      if (typeof ctrl !== "symbol") {
        if (identity.isCollection(node)) {
          path = Object.freeze(path.concat(node));
          for (let i = 0; i < node.items.length; ++i) {
            const ci = await visitAsync_(i, node.items[i], visitor, path);
            if (typeof ci === "number")
              i = ci - 1;
            else if (ci === BREAK)
              return BREAK;
            else if (ci === REMOVE) {
              node.items.splice(i, 1);
              i -= 1;
            }
          }
        } else if (identity.isPair(node)) {
          path = Object.freeze(path.concat(node));
          const ck = await visitAsync_("key", node.key, visitor, path);
          if (ck === BREAK)
            return BREAK;
          else if (ck === REMOVE)
            node.key = null;
          const cv = await visitAsync_("value", node.value, visitor, path);
          if (cv === BREAK)
            return BREAK;
          else if (cv === REMOVE)
            node.value = null;
        }
      }
      return ctrl;
    }
    function initVisitor(visitor) {
      if (typeof visitor === "object" && (visitor.Collection || visitor.Node || visitor.Value)) {
        return Object.assign({
          Alias: visitor.Node,
          Map: visitor.Node,
          Scalar: visitor.Node,
          Seq: visitor.Node
        }, visitor.Value && {
          Map: visitor.Value,
          Scalar: visitor.Value,
          Seq: visitor.Value
        }, visitor.Collection && {
          Map: visitor.Collection,
          Seq: visitor.Collection
        }, visitor);
      }
      return visitor;
    }
    function callVisitor(key, node, visitor, path) {
      if (typeof visitor === "function")
        return visitor(key, node, path);
      if (identity.isMap(node))
        return visitor.Map?.(key, node, path);
      if (identity.isSeq(node))
        return visitor.Seq?.(key, node, path);
      if (identity.isPair(node))
        return visitor.Pair?.(key, node, path);
      if (identity.isScalar(node))
        return visitor.Scalar?.(key, node, path);
      if (identity.isAlias(node))
        return visitor.Alias?.(key, node, path);
      return void 0;
    }
    function replaceNode(key, path, node) {
      const parent = path[path.length - 1];
      if (identity.isCollection(parent)) {
        parent.items[key] = node;
      } else if (identity.isPair(parent)) {
        if (key === "key")
          parent.key = node;
        else
          parent.value = node;
      } else if (identity.isDocument(parent)) {
        parent.contents = node;
      } else {
        const pt = identity.isAlias(parent) ? "alias" : "scalar";
        throw new Error(`Cannot replace node with ${pt} parent`);
      }
    }
    exports.visit = visit;
    exports.visitAsync = visitAsync;
  }
});

// node_modules/yaml/dist/doc/directives.js
var require_directives = __commonJS({
  "node_modules/yaml/dist/doc/directives.js"(exports) {
    "use strict";
    var identity = require_identity();
    var visit = require_visit();
    var escapeChars = {
      "!": "%21",
      ",": "%2C",
      "[": "%5B",
      "]": "%5D",
      "{": "%7B",
      "}": "%7D"
    };
    var escapeTagName = (tn) => tn.replace(/[!,[\]{}]/g, (ch) => escapeChars[ch]);
    var Directives = class _Directives {
      constructor(yaml, tags) {
        this.docStart = null;
        this.docEnd = false;
        this.yaml = Object.assign({}, _Directives.defaultYaml, yaml);
        this.tags = Object.assign({}, _Directives.defaultTags, tags);
      }
      clone() {
        const copy = new _Directives(this.yaml, this.tags);
        copy.docStart = this.docStart;
        return copy;
      }
      /**
       * During parsing, get a Directives instance for the current document and
       * update the stream state according to the current version's spec.
       */
      atDocument() {
        const res = new _Directives(this.yaml, this.tags);
        switch (this.yaml.version) {
          case "1.1":
            this.atNextDocument = true;
            break;
          case "1.2":
            this.atNextDocument = false;
            this.yaml = {
              explicit: _Directives.defaultYaml.explicit,
              version: "1.2"
            };
            this.tags = Object.assign({}, _Directives.defaultTags);
            break;
        }
        return res;
      }
      /**
       * @param onError - May be called even if the action was successful
       * @returns `true` on success
       */
      add(line, onError) {
        if (this.atNextDocument) {
          this.yaml = { explicit: _Directives.defaultYaml.explicit, version: "1.1" };
          this.tags = Object.assign({}, _Directives.defaultTags);
          this.atNextDocument = false;
        }
        const parts = line.trim().split(/[ \t]+/);
        const name = parts.shift();
        switch (name) {
          case "%TAG": {
            if (parts.length !== 2) {
              onError(0, "%TAG directive should contain exactly two parts");
              if (parts.length < 2)
                return false;
            }
            const [handle, prefix] = parts;
            this.tags[handle] = prefix;
            return true;
          }
          case "%YAML": {
            this.yaml.explicit = true;
            if (parts.length !== 1) {
              onError(0, "%YAML directive should contain exactly one part");
              return false;
            }
            const [version] = parts;
            if (version === "1.1" || version === "1.2") {
              this.yaml.version = version;
              return true;
            } else {
              const isValid2 = /^\d+\.\d+$/.test(version);
              onError(6, `Unsupported YAML version ${version}`, isValid2);
              return false;
            }
          }
          default:
            onError(0, `Unknown directive ${name}`, true);
            return false;
        }
      }
      /**
       * Resolves a tag, matching handles to those defined in %TAG directives.
       *
       * @returns Resolved tag, which may also be the non-specific tag `'!'` or a
       *   `'!local'` tag, or `null` if unresolvable.
       */
      tagName(source, onError) {
        if (source === "!")
          return "!";
        if (source[0] !== "!") {
          onError(`Not a valid tag: ${source}`);
          return null;
        }
        if (source[1] === "<") {
          const verbatim = source.slice(2, -1);
          if (verbatim === "!" || verbatim === "!!") {
            onError(`Verbatim tags aren't resolved, so ${source} is invalid.`);
            return null;
          }
          if (source[source.length - 1] !== ">")
            onError("Verbatim tags must end with a >");
          return verbatim;
        }
        const [, handle, suffix] = source.match(/^(.*!)([^!]*)$/s);
        if (!suffix)
          onError(`The ${source} tag has no suffix`);
        const prefix = this.tags[handle];
        if (prefix) {
          try {
            return prefix + decodeURIComponent(suffix);
          } catch (error) {
            onError(String(error));
            return null;
          }
        }
        if (handle === "!")
          return source;
        onError(`Could not resolve tag: ${source}`);
        return null;
      }
      /**
       * Given a fully resolved tag, returns its printable string form,
       * taking into account current tag prefixes and defaults.
       */
      tagString(tag) {
        for (const [handle, prefix] of Object.entries(this.tags)) {
          if (tag.startsWith(prefix))
            return handle + escapeTagName(tag.substring(prefix.length));
        }
        return tag[0] === "!" ? tag : `!<${tag}>`;
      }
      toString(doc) {
        const lines = this.yaml.explicit ? [`%YAML ${this.yaml.version || "1.2"}`] : [];
        const tagEntries = Object.entries(this.tags);
        let tagNames;
        if (doc && tagEntries.length > 0 && identity.isNode(doc.contents)) {
          const tags = {};
          visit.visit(doc.contents, (_key, node) => {
            if (identity.isNode(node) && node.tag)
              tags[node.tag] = true;
          });
          tagNames = Object.keys(tags);
        } else
          tagNames = [];
        for (const [handle, prefix] of tagEntries) {
          if (handle === "!!" && prefix === "tag:yaml.org,2002:")
            continue;
          if (!doc || tagNames.some((tn) => tn.startsWith(prefix)))
            lines.push(`%TAG ${handle} ${prefix}`);
        }
        return lines.join("\n");
      }
    };
    Directives.defaultYaml = { explicit: false, version: "1.2" };
    Directives.defaultTags = { "!!": "tag:yaml.org,2002:" };
    exports.Directives = Directives;
  }
});

// node_modules/yaml/dist/doc/anchors.js
var require_anchors = __commonJS({
  "node_modules/yaml/dist/doc/anchors.js"(exports) {
    "use strict";
    var identity = require_identity();
    var visit = require_visit();
    function anchorIsValid(anchor) {
      if (/[\x00-\x19\s,[\]{}]/.test(anchor)) {
        const sa = JSON.stringify(anchor);
        const msg = `Anchor must not contain whitespace or control characters: ${sa}`;
        throw new Error(msg);
      }
      return true;
    }
    function anchorNames(root) {
      const anchors = /* @__PURE__ */ new Set();
      visit.visit(root, {
        Value(_key, node) {
          if (node.anchor)
            anchors.add(node.anchor);
        }
      });
      return anchors;
    }
    function findNewAnchor(prefix, exclude) {
      for (let i = 1; true; ++i) {
        const name = `${prefix}${i}`;
        if (!exclude.has(name))
          return name;
      }
    }
    function createNodeAnchors(doc, prefix) {
      const aliasObjects = [];
      const sourceObjects = /* @__PURE__ */ new Map();
      let prevAnchors = null;
      return {
        onAnchor: (source) => {
          aliasObjects.push(source);
          prevAnchors ?? (prevAnchors = anchorNames(doc));
          const anchor = findNewAnchor(prefix, prevAnchors);
          prevAnchors.add(anchor);
          return anchor;
        },
        /**
         * With circular references, the source node is only resolved after all
         * of its child nodes are. This is why anchors are set only after all of
         * the nodes have been created.
         */
        setAnchors: () => {
          for (const source of aliasObjects) {
            const ref = sourceObjects.get(source);
            if (typeof ref === "object" && ref.anchor && (identity.isScalar(ref.node) || identity.isCollection(ref.node))) {
              ref.node.anchor = ref.anchor;
            } else {
              const error = new Error("Failed to resolve repeated object (this should not happen)");
              error.source = source;
              throw error;
            }
          }
        },
        sourceObjects
      };
    }
    exports.anchorIsValid = anchorIsValid;
    exports.anchorNames = anchorNames;
    exports.createNodeAnchors = createNodeAnchors;
    exports.findNewAnchor = findNewAnchor;
  }
});

// node_modules/yaml/dist/doc/applyReviver.js
var require_applyReviver = __commonJS({
  "node_modules/yaml/dist/doc/applyReviver.js"(exports) {
    "use strict";
    function applyReviver(reviver, obj, key, val) {
      if (val && typeof val === "object") {
        if (Array.isArray(val)) {
          for (let i = 0, len = val.length; i < len; ++i) {
            const v0 = val[i];
            const v1 = applyReviver(reviver, val, String(i), v0);
            if (v1 === void 0)
              delete val[i];
            else if (v1 !== v0)
              val[i] = v1;
          }
        } else if (val instanceof Map) {
          for (const k of Array.from(val.keys())) {
            const v0 = val.get(k);
            const v1 = applyReviver(reviver, val, k, v0);
            if (v1 === void 0)
              val.delete(k);
            else if (v1 !== v0)
              val.set(k, v1);
          }
        } else if (val instanceof Set) {
          for (const v0 of Array.from(val)) {
            const v1 = applyReviver(reviver, val, v0, v0);
            if (v1 === void 0)
              val.delete(v0);
            else if (v1 !== v0) {
              val.delete(v0);
              val.add(v1);
            }
          }
        } else {
          for (const [k, v0] of Object.entries(val)) {
            const v1 = applyReviver(reviver, val, k, v0);
            if (v1 === void 0)
              delete val[k];
            else if (v1 !== v0)
              val[k] = v1;
          }
        }
      }
      return reviver.call(obj, key, val);
    }
    exports.applyReviver = applyReviver;
  }
});

// node_modules/yaml/dist/nodes/toJS.js
var require_toJS = __commonJS({
  "node_modules/yaml/dist/nodes/toJS.js"(exports) {
    "use strict";
    var identity = require_identity();
    function toJS(value, arg, ctx) {
      if (Array.isArray(value))
        return value.map((v, i) => toJS(v, String(i), ctx));
      if (value && typeof value.toJSON === "function") {
        if (!ctx || !identity.hasAnchor(value))
          return value.toJSON(arg, ctx);
        const data = { aliasCount: 0, count: 1, res: void 0 };
        ctx.anchors.set(value, data);
        ctx.onCreate = (res2) => {
          data.res = res2;
          delete ctx.onCreate;
        };
        const res = value.toJSON(arg, ctx);
        if (ctx.onCreate)
          ctx.onCreate(res);
        return res;
      }
      if (typeof value === "bigint" && !ctx?.keep)
        return Number(value);
      return value;
    }
    exports.toJS = toJS;
  }
});

// node_modules/yaml/dist/nodes/Node.js
var require_Node = __commonJS({
  "node_modules/yaml/dist/nodes/Node.js"(exports) {
    "use strict";
    var applyReviver = require_applyReviver();
    var identity = require_identity();
    var toJS = require_toJS();
    var NodeBase = class {
      constructor(type) {
        Object.defineProperty(this, identity.NODE_TYPE, { value: type });
      }
      /** Create a copy of this node.  */
      clone() {
        const copy = Object.create(Object.getPrototypeOf(this), Object.getOwnPropertyDescriptors(this));
        if (this.range)
          copy.range = this.range.slice();
        return copy;
      }
      /** A plain JavaScript representation of this node. */
      toJS(doc, { mapAsMap, maxAliasCount, onAnchor, reviver } = {}) {
        if (!identity.isDocument(doc))
          throw new TypeError("A document argument is required");
        const ctx = {
          anchors: /* @__PURE__ */ new Map(),
          doc,
          keep: true,
          mapAsMap: mapAsMap === true,
          mapKeyWarned: false,
          maxAliasCount: typeof maxAliasCount === "number" ? maxAliasCount : 100
        };
        const res = toJS.toJS(this, "", ctx);
        if (typeof onAnchor === "function")
          for (const { count, res: res2 } of ctx.anchors.values())
            onAnchor(res2, count);
        return typeof reviver === "function" ? applyReviver.applyReviver(reviver, { "": res }, "", res) : res;
      }
    };
    exports.NodeBase = NodeBase;
  }
});

// node_modules/yaml/dist/nodes/Alias.js
var require_Alias = __commonJS({
  "node_modules/yaml/dist/nodes/Alias.js"(exports) {
    "use strict";
    var anchors = require_anchors();
    var visit = require_visit();
    var identity = require_identity();
    var Node = require_Node();
    var toJS = require_toJS();
    var Alias = class extends Node.NodeBase {
      constructor(source) {
        super(identity.ALIAS);
        this.source = source;
        Object.defineProperty(this, "tag", {
          set() {
            throw new Error("Alias nodes cannot have tags");
          }
        });
      }
      /**
       * Resolve the value of this alias within `doc`, finding the last
       * instance of the `source` anchor before this node.
       */
      resolve(doc, ctx) {
        let nodes;
        if (ctx?.aliasResolveCache) {
          nodes = ctx.aliasResolveCache;
        } else {
          nodes = [];
          visit.visit(doc, {
            Node: (_key, node) => {
              if (identity.isAlias(node) || identity.hasAnchor(node))
                nodes.push(node);
            }
          });
          if (ctx)
            ctx.aliasResolveCache = nodes;
        }
        let found = void 0;
        for (const node of nodes) {
          if (node === this)
            break;
          if (node.anchor === this.source)
            found = node;
        }
        return found;
      }
      toJSON(_arg, ctx) {
        if (!ctx)
          return { source: this.source };
        const { anchors: anchors2, doc, maxAliasCount } = ctx;
        const source = this.resolve(doc, ctx);
        if (!source) {
          const msg = `Unresolved alias (the anchor must be set before the alias): ${this.source}`;
          throw new ReferenceError(msg);
        }
        let data = anchors2.get(source);
        if (!data) {
          toJS.toJS(source, null, ctx);
          data = anchors2.get(source);
        }
        if (data?.res === void 0) {
          const msg = "This should not happen: Alias anchor was not resolved?";
          throw new ReferenceError(msg);
        }
        if (maxAliasCount >= 0) {
          data.count += 1;
          if (data.aliasCount === 0)
            data.aliasCount = getAliasCount(doc, source, anchors2);
          if (data.count * data.aliasCount > maxAliasCount) {
            const msg = "Excessive alias count indicates a resource exhaustion attack";
            throw new ReferenceError(msg);
          }
        }
        return data.res;
      }
      toString(ctx, _onComment, _onChompKeep) {
        const src = `*${this.source}`;
        if (ctx) {
          anchors.anchorIsValid(this.source);
          if (ctx.options.verifyAliasOrder && !ctx.anchors.has(this.source)) {
            const msg = `Unresolved alias (the anchor must be set before the alias): ${this.source}`;
            throw new Error(msg);
          }
          if (ctx.implicitKey)
            return `${src} `;
        }
        return src;
      }
    };
    function getAliasCount(doc, node, anchors2) {
      if (identity.isAlias(node)) {
        const source = node.resolve(doc);
        const anchor = anchors2 && source && anchors2.get(source);
        return anchor ? anchor.count * anchor.aliasCount : 0;
      } else if (identity.isCollection(node)) {
        let count = 0;
        for (const item of node.items) {
          const c = getAliasCount(doc, item, anchors2);
          if (c > count)
            count = c;
        }
        return count;
      } else if (identity.isPair(node)) {
        const kc = getAliasCount(doc, node.key, anchors2);
        const vc = getAliasCount(doc, node.value, anchors2);
        return Math.max(kc, vc);
      }
      return 1;
    }
    exports.Alias = Alias;
  }
});

// node_modules/yaml/dist/nodes/Scalar.js
var require_Scalar = __commonJS({
  "node_modules/yaml/dist/nodes/Scalar.js"(exports) {
    "use strict";
    var identity = require_identity();
    var Node = require_Node();
    var toJS = require_toJS();
    var isScalarValue = (value) => !value || typeof value !== "function" && typeof value !== "object";
    var Scalar = class extends Node.NodeBase {
      constructor(value) {
        super(identity.SCALAR);
        this.value = value;
      }
      toJSON(arg, ctx) {
        return ctx?.keep ? this.value : toJS.toJS(this.value, arg, ctx);
      }
      toString() {
        return String(this.value);
      }
    };
    Scalar.BLOCK_FOLDED = "BLOCK_FOLDED";
    Scalar.BLOCK_LITERAL = "BLOCK_LITERAL";
    Scalar.PLAIN = "PLAIN";
    Scalar.QUOTE_DOUBLE = "QUOTE_DOUBLE";
    Scalar.QUOTE_SINGLE = "QUOTE_SINGLE";
    exports.Scalar = Scalar;
    exports.isScalarValue = isScalarValue;
  }
});

// node_modules/yaml/dist/doc/createNode.js
var require_createNode = __commonJS({
  "node_modules/yaml/dist/doc/createNode.js"(exports) {
    "use strict";
    var Alias = require_Alias();
    var identity = require_identity();
    var Scalar = require_Scalar();
    var defaultTagPrefix = "tag:yaml.org,2002:";
    function findTagObject(value, tagName, tags) {
      if (tagName) {
        const match = tags.filter((t) => t.tag === tagName);
        const tagObj = match.find((t) => !t.format) ?? match[0];
        if (!tagObj)
          throw new Error(`Tag ${tagName} not found`);
        return tagObj;
      }
      return tags.find((t) => t.identify?.(value) && !t.format);
    }
    function createNode(value, tagName, ctx) {
      if (identity.isDocument(value))
        value = value.contents;
      if (identity.isNode(value))
        return value;
      if (identity.isPair(value)) {
        const map = ctx.schema[identity.MAP].createNode?.(ctx.schema, null, ctx);
        map.items.push(value);
        return map;
      }
      if (value instanceof String || value instanceof Number || value instanceof Boolean || typeof BigInt !== "undefined" && value instanceof BigInt) {
        value = value.valueOf();
      }
      const { aliasDuplicateObjects, onAnchor, onTagObj, schema, sourceObjects } = ctx;
      let ref = void 0;
      if (aliasDuplicateObjects && value && typeof value === "object") {
        ref = sourceObjects.get(value);
        if (ref) {
          ref.anchor ?? (ref.anchor = onAnchor(value));
          return new Alias.Alias(ref.anchor);
        } else {
          ref = { anchor: null, node: null };
          sourceObjects.set(value, ref);
        }
      }
      if (tagName?.startsWith("!!"))
        tagName = defaultTagPrefix + tagName.slice(2);
      let tagObj = findTagObject(value, tagName, schema.tags);
      if (!tagObj) {
        if (value && typeof value.toJSON === "function") {
          value = value.toJSON();
        }
        if (!value || typeof value !== "object") {
          const node2 = new Scalar.Scalar(value);
          if (ref)
            ref.node = node2;
          return node2;
        }
        tagObj = value instanceof Map ? schema[identity.MAP] : Symbol.iterator in Object(value) ? schema[identity.SEQ] : schema[identity.MAP];
      }
      if (onTagObj) {
        onTagObj(tagObj);
        delete ctx.onTagObj;
      }
      const node = tagObj?.createNode ? tagObj.createNode(ctx.schema, value, ctx) : typeof tagObj?.nodeClass?.from === "function" ? tagObj.nodeClass.from(ctx.schema, value, ctx) : new Scalar.Scalar(value);
      if (tagName)
        node.tag = tagName;
      else if (!tagObj.default)
        node.tag = tagObj.tag;
      if (ref)
        ref.node = node;
      return node;
    }
    exports.createNode = createNode;
  }
});

// node_modules/yaml/dist/nodes/Collection.js
var require_Collection = __commonJS({
  "node_modules/yaml/dist/nodes/Collection.js"(exports) {
    "use strict";
    var createNode = require_createNode();
    var identity = require_identity();
    var Node = require_Node();
    function collectionFromPath(schema, path, value) {
      let v = value;
      for (let i = path.length - 1; i >= 0; --i) {
        const k = path[i];
        if (typeof k === "number" && Number.isInteger(k) && k >= 0) {
          const a = [];
          a[k] = v;
          v = a;
        } else {
          v = /* @__PURE__ */ new Map([[k, v]]);
        }
      }
      return createNode.createNode(v, void 0, {
        aliasDuplicateObjects: false,
        keepUndefined: false,
        onAnchor: () => {
          throw new Error("This should not happen, please report a bug.");
        },
        schema,
        sourceObjects: /* @__PURE__ */ new Map()
      });
    }
    var isEmptyPath = (path) => path == null || typeof path === "object" && !!path[Symbol.iterator]().next().done;
    var Collection = class extends Node.NodeBase {
      constructor(type, schema) {
        super(type);
        Object.defineProperty(this, "schema", {
          value: schema,
          configurable: true,
          enumerable: false,
          writable: true
        });
      }
      /**
       * Create a copy of this collection.
       *
       * @param schema - If defined, overwrites the original's schema
       */
      clone(schema) {
        const copy = Object.create(Object.getPrototypeOf(this), Object.getOwnPropertyDescriptors(this));
        if (schema)
          copy.schema = schema;
        copy.items = copy.items.map((it) => identity.isNode(it) || identity.isPair(it) ? it.clone(schema) : it);
        if (this.range)
          copy.range = this.range.slice();
        return copy;
      }
      /**
       * Adds a value to the collection. For `!!map` and `!!omap` the value must
       * be a Pair instance or a `{ key, value }` object, which may not have a key
       * that already exists in the map.
       */
      addIn(path, value) {
        if (isEmptyPath(path))
          this.add(value);
        else {
          const [key, ...rest] = path;
          const node = this.get(key, true);
          if (identity.isCollection(node))
            node.addIn(rest, value);
          else if (node === void 0 && this.schema)
            this.set(key, collectionFromPath(this.schema, rest, value));
          else
            throw new Error(`Expected YAML collection at ${key}. Remaining path: ${rest}`);
        }
      }
      /**
       * Removes a value from the collection.
       * @returns `true` if the item was found and removed.
       */
      deleteIn(path) {
        const [key, ...rest] = path;
        if (rest.length === 0)
          return this.delete(key);
        const node = this.get(key, true);
        if (identity.isCollection(node))
          return node.deleteIn(rest);
        else
          throw new Error(`Expected YAML collection at ${key}. Remaining path: ${rest}`);
      }
      /**
       * Returns item at `key`, or `undefined` if not found. By default unwraps
       * scalar values from their surrounding node; to disable set `keepScalar` to
       * `true` (collections are always returned intact).
       */
      getIn(path, keepScalar) {
        const [key, ...rest] = path;
        const node = this.get(key, true);
        if (rest.length === 0)
          return !keepScalar && identity.isScalar(node) ? node.value : node;
        else
          return identity.isCollection(node) ? node.getIn(rest, keepScalar) : void 0;
      }
      hasAllNullValues(allowScalar) {
        return this.items.every((node) => {
          if (!identity.isPair(node))
            return false;
          const n = node.value;
          return n == null || allowScalar && identity.isScalar(n) && n.value == null && !n.commentBefore && !n.comment && !n.tag;
        });
      }
      /**
       * Checks if the collection includes a value with the key `key`.
       */
      hasIn(path) {
        const [key, ...rest] = path;
        if (rest.length === 0)
          return this.has(key);
        const node = this.get(key, true);
        return identity.isCollection(node) ? node.hasIn(rest) : false;
      }
      /**
       * Sets a value in this collection. For `!!set`, `value` needs to be a
       * boolean to add/remove the item from the set.
       */
      setIn(path, value) {
        const [key, ...rest] = path;
        if (rest.length === 0) {
          this.set(key, value);
        } else {
          const node = this.get(key, true);
          if (identity.isCollection(node))
            node.setIn(rest, value);
          else if (node === void 0 && this.schema)
            this.set(key, collectionFromPath(this.schema, rest, value));
          else
            throw new Error(`Expected YAML collection at ${key}. Remaining path: ${rest}`);
        }
      }
    };
    exports.Collection = Collection;
    exports.collectionFromPath = collectionFromPath;
    exports.isEmptyPath = isEmptyPath;
  }
});

// node_modules/yaml/dist/stringify/stringifyComment.js
var require_stringifyComment = __commonJS({
  "node_modules/yaml/dist/stringify/stringifyComment.js"(exports) {
    "use strict";
    var stringifyComment = (str) => str.replace(/^(?!$)(?: $)?/gm, "#");
    function indentComment(comment, indent) {
      if (/^\n+$/.test(comment))
        return comment.substring(1);
      return indent ? comment.replace(/^(?! *$)/gm, indent) : comment;
    }
    var lineComment = (str, indent, comment) => str.endsWith("\n") ? indentComment(comment, indent) : comment.includes("\n") ? "\n" + indentComment(comment, indent) : (str.endsWith(" ") ? "" : " ") + comment;
    exports.indentComment = indentComment;
    exports.lineComment = lineComment;
    exports.stringifyComment = stringifyComment;
  }
});

// node_modules/yaml/dist/stringify/foldFlowLines.js
var require_foldFlowLines = __commonJS({
  "node_modules/yaml/dist/stringify/foldFlowLines.js"(exports) {
    "use strict";
    var FOLD_FLOW = "flow";
    var FOLD_BLOCK = "block";
    var FOLD_QUOTED = "quoted";
    function foldFlowLines(text, indent, mode = "flow", { indentAtStart, lineWidth = 80, minContentWidth = 20, onFold, onOverflow } = {}) {
      if (!lineWidth || lineWidth < 0)
        return text;
      if (lineWidth < minContentWidth)
        minContentWidth = 0;
      const endStep = Math.max(1 + minContentWidth, 1 + lineWidth - indent.length);
      if (text.length <= endStep)
        return text;
      const folds = [];
      const escapedFolds = {};
      let end = lineWidth - indent.length;
      if (typeof indentAtStart === "number") {
        if (indentAtStart > lineWidth - Math.max(2, minContentWidth))
          folds.push(0);
        else
          end = lineWidth - indentAtStart;
      }
      let split = void 0;
      let prev = void 0;
      let overflow = false;
      let i = -1;
      let escStart = -1;
      let escEnd = -1;
      if (mode === FOLD_BLOCK) {
        i = consumeMoreIndentedLines(text, i, indent.length);
        if (i !== -1)
          end = i + endStep;
      }
      for (let ch; ch = text[i += 1]; ) {
        if (mode === FOLD_QUOTED && ch === "\\") {
          escStart = i;
          switch (text[i + 1]) {
            case "x":
              i += 3;
              break;
            case "u":
              i += 5;
              break;
            case "U":
              i += 9;
              break;
            default:
              i += 1;
          }
          escEnd = i;
        }
        if (ch === "\n") {
          if (mode === FOLD_BLOCK)
            i = consumeMoreIndentedLines(text, i, indent.length);
          end = i + indent.length + endStep;
          split = void 0;
        } else {
          if (ch === " " && prev && prev !== " " && prev !== "\n" && prev !== "	") {
            const next = text[i + 1];
            if (next && next !== " " && next !== "\n" && next !== "	")
              split = i;
          }
          if (i >= end) {
            if (split) {
              folds.push(split);
              end = split + endStep;
              split = void 0;
            } else if (mode === FOLD_QUOTED) {
              while (prev === " " || prev === "	") {
                prev = ch;
                ch = text[i += 1];
                overflow = true;
              }
              const j = i > escEnd + 1 ? i - 2 : escStart - 1;
              if (escapedFolds[j])
                return text;
              folds.push(j);
              escapedFolds[j] = true;
              end = j + endStep;
              split = void 0;
            } else {
              overflow = true;
            }
          }
        }
        prev = ch;
      }
      if (overflow && onOverflow)
        onOverflow();
      if (folds.length === 0)
        return text;
      if (onFold)
        onFold();
      let res = text.slice(0, folds[0]);
      for (let i2 = 0; i2 < folds.length; ++i2) {
        const fold = folds[i2];
        const end2 = folds[i2 + 1] || text.length;
        if (fold === 0)
          res = `
${indent}${text.slice(0, end2)}`;
        else {
          if (mode === FOLD_QUOTED && escapedFolds[fold])
            res += `${text[fold]}\\`;
          res += `
${indent}${text.slice(fold + 1, end2)}`;
        }
      }
      return res;
    }
    function consumeMoreIndentedLines(text, i, indent) {
      let end = i;
      let start = i + 1;
      let ch = text[start];
      while (ch === " " || ch === "	") {
        if (i < start + indent) {
          ch = text[++i];
        } else {
          do {
            ch = text[++i];
          } while (ch && ch !== "\n");
          end = i;
          start = i + 1;
          ch = text[start];
        }
      }
      return end;
    }
    exports.FOLD_BLOCK = FOLD_BLOCK;
    exports.FOLD_FLOW = FOLD_FLOW;
    exports.FOLD_QUOTED = FOLD_QUOTED;
    exports.foldFlowLines = foldFlowLines;
  }
});

// node_modules/yaml/dist/stringify/stringifyString.js
var require_stringifyString = __commonJS({
  "node_modules/yaml/dist/stringify/stringifyString.js"(exports) {
    "use strict";
    var Scalar = require_Scalar();
    var foldFlowLines = require_foldFlowLines();
    var getFoldOptions = (ctx, isBlock) => ({
      indentAtStart: isBlock ? ctx.indent.length : ctx.indentAtStart,
      lineWidth: ctx.options.lineWidth,
      minContentWidth: ctx.options.minContentWidth
    });
    var containsDocumentMarker = (str) => /^(%|---|\.\.\.)/m.test(str);
    function lineLengthOverLimit(str, lineWidth, indentLength) {
      if (!lineWidth || lineWidth < 0)
        return false;
      const limit = lineWidth - indentLength;
      const strLen = str.length;
      if (strLen <= limit)
        return false;
      for (let i = 0, start = 0; i < strLen; ++i) {
        if (str[i] === "\n") {
          if (i - start > limit)
            return true;
          start = i + 1;
          if (strLen - start <= limit)
            return false;
        }
      }
      return true;
    }
    function doubleQuotedString(value, ctx) {
      const json = JSON.stringify(value);
      if (ctx.options.doubleQuotedAsJSON)
        return json;
      const { implicitKey } = ctx;
      const minMultiLineLength = ctx.options.doubleQuotedMinMultiLineLength;
      const indent = ctx.indent || (containsDocumentMarker(value) ? "  " : "");
      let str = "";
      let start = 0;
      for (let i = 0, ch = json[i]; ch; ch = json[++i]) {
        if (ch === " " && json[i + 1] === "\\" && json[i + 2] === "n") {
          str += json.slice(start, i) + "\\ ";
          i += 1;
          start = i;
          ch = "\\";
        }
        if (ch === "\\")
          switch (json[i + 1]) {
            case "u":
              {
                str += json.slice(start, i);
                const code = json.substr(i + 2, 4);
                switch (code) {
                  case "0000":
                    str += "\\0";
                    break;
                  case "0007":
                    str += "\\a";
                    break;
                  case "000b":
                    str += "\\v";
                    break;
                  case "001b":
                    str += "\\e";
                    break;
                  case "0085":
                    str += "\\N";
                    break;
                  case "00a0":
                    str += "\\_";
                    break;
                  case "2028":
                    str += "\\L";
                    break;
                  case "2029":
                    str += "\\P";
                    break;
                  default:
                    if (code.substr(0, 2) === "00")
                      str += "\\x" + code.substr(2);
                    else
                      str += json.substr(i, 6);
                }
                i += 5;
                start = i + 1;
              }
              break;
            case "n":
              if (implicitKey || json[i + 2] === '"' || json.length < minMultiLineLength) {
                i += 1;
              } else {
                str += json.slice(start, i) + "\n\n";
                while (json[i + 2] === "\\" && json[i + 3] === "n" && json[i + 4] !== '"') {
                  str += "\n";
                  i += 2;
                }
                str += indent;
                if (json[i + 2] === " ")
                  str += "\\";
                i += 1;
                start = i + 1;
              }
              break;
            default:
              i += 1;
          }
      }
      str = start ? str + json.slice(start) : json;
      return implicitKey ? str : foldFlowLines.foldFlowLines(str, indent, foldFlowLines.FOLD_QUOTED, getFoldOptions(ctx, false));
    }
    function singleQuotedString(value, ctx) {
      if (ctx.options.singleQuote === false || ctx.implicitKey && value.includes("\n") || /[ \t]\n|\n[ \t]/.test(value))
        return doubleQuotedString(value, ctx);
      const indent = ctx.indent || (containsDocumentMarker(value) ? "  " : "");
      const res = "'" + value.replace(/'/g, "''").replace(/\n+/g, `$&
${indent}`) + "'";
      return ctx.implicitKey ? res : foldFlowLines.foldFlowLines(res, indent, foldFlowLines.FOLD_FLOW, getFoldOptions(ctx, false));
    }
    function quotedString(value, ctx) {
      const { singleQuote } = ctx.options;
      let qs;
      if (singleQuote === false)
        qs = doubleQuotedString;
      else {
        const hasDouble = value.includes('"');
        const hasSingle = value.includes("'");
        if (hasDouble && !hasSingle)
          qs = singleQuotedString;
        else if (hasSingle && !hasDouble)
          qs = doubleQuotedString;
        else
          qs = singleQuote ? singleQuotedString : doubleQuotedString;
      }
      return qs(value, ctx);
    }
    var blockEndNewlines;
    try {
      blockEndNewlines = new RegExp("(^|(?<!\n))\n+(?!\n|$)", "g");
    } catch {
      blockEndNewlines = /\n+(?!\n|$)/g;
    }
    function blockString({ comment, type, value }, ctx, onComment, onChompKeep) {
      const { blockQuote, commentString, lineWidth } = ctx.options;
      if (!blockQuote || /\n[\t ]+$/.test(value)) {
        return quotedString(value, ctx);
      }
      const indent = ctx.indent || (ctx.forceBlockIndent || containsDocumentMarker(value) ? "  " : "");
      const literal = blockQuote === "literal" ? true : blockQuote === "folded" || type === Scalar.Scalar.BLOCK_FOLDED ? false : type === Scalar.Scalar.BLOCK_LITERAL ? true : !lineLengthOverLimit(value, lineWidth, indent.length);
      if (!value)
        return literal ? "|\n" : ">\n";
      let chomp;
      let endStart;
      for (endStart = value.length; endStart > 0; --endStart) {
        const ch = value[endStart - 1];
        if (ch !== "\n" && ch !== "	" && ch !== " ")
          break;
      }
      let end = value.substring(endStart);
      const endNlPos = end.indexOf("\n");
      if (endNlPos === -1) {
        chomp = "-";
      } else if (value === end || endNlPos !== end.length - 1) {
        chomp = "+";
        if (onChompKeep)
          onChompKeep();
      } else {
        chomp = "";
      }
      if (end) {
        value = value.slice(0, -end.length);
        if (end[end.length - 1] === "\n")
          end = end.slice(0, -1);
        end = end.replace(blockEndNewlines, `$&${indent}`);
      }
      let startWithSpace = false;
      let startEnd;
      let startNlPos = -1;
      for (startEnd = 0; startEnd < value.length; ++startEnd) {
        const ch = value[startEnd];
        if (ch === " ")
          startWithSpace = true;
        else if (ch === "\n")
          startNlPos = startEnd;
        else
          break;
      }
      let start = value.substring(0, startNlPos < startEnd ? startNlPos + 1 : startEnd);
      if (start) {
        value = value.substring(start.length);
        start = start.replace(/\n+/g, `$&${indent}`);
      }
      const indentSize = indent ? "2" : "1";
      let header = (startWithSpace ? indentSize : "") + chomp;
      if (comment) {
        header += " " + commentString(comment.replace(/ ?[\r\n]+/g, " "));
        if (onComment)
          onComment();
      }
      if (!literal) {
        const foldedValue = value.replace(/\n+/g, "\n$&").replace(/(?:^|\n)([\t ].*)(?:([\n\t ]*)\n(?![\n\t ]))?/g, "$1$2").replace(/\n+/g, `$&${indent}`);
        let literalFallback = false;
        const foldOptions = getFoldOptions(ctx, true);
        if (blockQuote !== "folded" && type !== Scalar.Scalar.BLOCK_FOLDED) {
          foldOptions.onOverflow = () => {
            literalFallback = true;
          };
        }
        const body = foldFlowLines.foldFlowLines(`${start}${foldedValue}${end}`, indent, foldFlowLines.FOLD_BLOCK, foldOptions);
        if (!literalFallback)
          return `>${header}
${indent}${body}`;
      }
      value = value.replace(/\n+/g, `$&${indent}`);
      return `|${header}
${indent}${start}${value}${end}`;
    }
    function plainString(item, ctx, onComment, onChompKeep) {
      const { type, value } = item;
      const { actualString, implicitKey, indent, indentStep, inFlow } = ctx;
      if (implicitKey && value.includes("\n") || inFlow && /[[\]{},]/.test(value)) {
        return quotedString(value, ctx);
      }
      if (/^[\n\t ,[\]{}#&*!|>'"%@`]|^[?-]$|^[?-][ \t]|[\n:][ \t]|[ \t]\n|[\n\t ]#|[\n\t :]$/.test(value)) {
        return implicitKey || inFlow || !value.includes("\n") ? quotedString(value, ctx) : blockString(item, ctx, onComment, onChompKeep);
      }
      if (!implicitKey && !inFlow && type !== Scalar.Scalar.PLAIN && value.includes("\n")) {
        return blockString(item, ctx, onComment, onChompKeep);
      }
      if (containsDocumentMarker(value)) {
        if (indent === "") {
          ctx.forceBlockIndent = true;
          return blockString(item, ctx, onComment, onChompKeep);
        } else if (implicitKey && indent === indentStep) {
          return quotedString(value, ctx);
        }
      }
      const str = value.replace(/\n+/g, `$&
${indent}`);
      if (actualString) {
        const test = (tag) => tag.default && tag.tag !== "tag:yaml.org,2002:str" && tag.test?.test(str);
        const { compat, tags } = ctx.doc.schema;
        if (tags.some(test) || compat?.some(test))
          return quotedString(value, ctx);
      }
      return implicitKey ? str : foldFlowLines.foldFlowLines(str, indent, foldFlowLines.FOLD_FLOW, getFoldOptions(ctx, false));
    }
    function stringifyString(item, ctx, onComment, onChompKeep) {
      const { implicitKey, inFlow } = ctx;
      const ss = typeof item.value === "string" ? item : Object.assign({}, item, { value: String(item.value) });
      let { type } = item;
      if (type !== Scalar.Scalar.QUOTE_DOUBLE) {
        if (/[\x00-\x08\x0b-\x1f\x7f-\x9f\u{D800}-\u{DFFF}]/u.test(ss.value))
          type = Scalar.Scalar.QUOTE_DOUBLE;
      }
      const _stringify = (_type) => {
        switch (_type) {
          case Scalar.Scalar.BLOCK_FOLDED:
          case Scalar.Scalar.BLOCK_LITERAL:
            return implicitKey || inFlow ? quotedString(ss.value, ctx) : blockString(ss, ctx, onComment, onChompKeep);
          case Scalar.Scalar.QUOTE_DOUBLE:
            return doubleQuotedString(ss.value, ctx);
          case Scalar.Scalar.QUOTE_SINGLE:
            return singleQuotedString(ss.value, ctx);
          case Scalar.Scalar.PLAIN:
            return plainString(ss, ctx, onComment, onChompKeep);
          default:
            return null;
        }
      };
      let res = _stringify(type);
      if (res === null) {
        const { defaultKeyType, defaultStringType } = ctx.options;
        const t = implicitKey && defaultKeyType || defaultStringType;
        res = _stringify(t);
        if (res === null)
          throw new Error(`Unsupported default string type ${t}`);
      }
      return res;
    }
    exports.stringifyString = stringifyString;
  }
});

// node_modules/yaml/dist/stringify/stringify.js
var require_stringify = __commonJS({
  "node_modules/yaml/dist/stringify/stringify.js"(exports) {
    "use strict";
    var anchors = require_anchors();
    var identity = require_identity();
    var stringifyComment = require_stringifyComment();
    var stringifyString = require_stringifyString();
    function createStringifyContext(doc, options) {
      const opt = Object.assign({
        blockQuote: true,
        commentString: stringifyComment.stringifyComment,
        defaultKeyType: null,
        defaultStringType: "PLAIN",
        directives: null,
        doubleQuotedAsJSON: false,
        doubleQuotedMinMultiLineLength: 40,
        falseStr: "false",
        flowCollectionPadding: true,
        indentSeq: true,
        lineWidth: 80,
        minContentWidth: 20,
        nullStr: "null",
        simpleKeys: false,
        singleQuote: null,
        trailingComma: false,
        trueStr: "true",
        verifyAliasOrder: true
      }, doc.schema.toStringOptions, options);
      let inFlow;
      switch (opt.collectionStyle) {
        case "block":
          inFlow = false;
          break;
        case "flow":
          inFlow = true;
          break;
        default:
          inFlow = null;
      }
      return {
        anchors: /* @__PURE__ */ new Set(),
        doc,
        flowCollectionPadding: opt.flowCollectionPadding ? " " : "",
        indent: "",
        indentStep: typeof opt.indent === "number" ? " ".repeat(opt.indent) : "  ",
        inFlow,
        options: opt
      };
    }
    function getTagObject(tags, item) {
      if (item.tag) {
        const match = tags.filter((t) => t.tag === item.tag);
        if (match.length > 0)
          return match.find((t) => t.format === item.format) ?? match[0];
      }
      let tagObj = void 0;
      let obj;
      if (identity.isScalar(item)) {
        obj = item.value;
        let match = tags.filter((t) => t.identify?.(obj));
        if (match.length > 1) {
          const testMatch = match.filter((t) => t.test);
          if (testMatch.length > 0)
            match = testMatch;
        }
        tagObj = match.find((t) => t.format === item.format) ?? match.find((t) => !t.format);
      } else {
        obj = item;
        tagObj = tags.find((t) => t.nodeClass && obj instanceof t.nodeClass);
      }
      if (!tagObj) {
        const name = obj?.constructor?.name ?? (obj === null ? "null" : typeof obj);
        throw new Error(`Tag not resolved for ${name} value`);
      }
      return tagObj;
    }
    function stringifyProps(node, tagObj, { anchors: anchors$1, doc }) {
      if (!doc.directives)
        return "";
      const props = [];
      const anchor = (identity.isScalar(node) || identity.isCollection(node)) && node.anchor;
      if (anchor && anchors.anchorIsValid(anchor)) {
        anchors$1.add(anchor);
        props.push(`&${anchor}`);
      }
      const tag = node.tag ?? (tagObj.default ? null : tagObj.tag);
      if (tag)
        props.push(doc.directives.tagString(tag));
      return props.join(" ");
    }
    function stringify(item, ctx, onComment, onChompKeep) {
      if (identity.isPair(item))
        return item.toString(ctx, onComment, onChompKeep);
      if (identity.isAlias(item)) {
        if (ctx.doc.directives)
          return item.toString(ctx);
        if (ctx.resolvedAliases?.has(item)) {
          throw new TypeError(`Cannot stringify circular structure without alias nodes`);
        } else {
          if (ctx.resolvedAliases)
            ctx.resolvedAliases.add(item);
          else
            ctx.resolvedAliases = /* @__PURE__ */ new Set([item]);
          item = item.resolve(ctx.doc);
        }
      }
      let tagObj = void 0;
      const node = identity.isNode(item) ? item : ctx.doc.createNode(item, { onTagObj: (o) => tagObj = o });
      tagObj ?? (tagObj = getTagObject(ctx.doc.schema.tags, node));
      const props = stringifyProps(node, tagObj, ctx);
      if (props.length > 0)
        ctx.indentAtStart = (ctx.indentAtStart ?? 0) + props.length + 1;
      const str = typeof tagObj.stringify === "function" ? tagObj.stringify(node, ctx, onComment, onChompKeep) : identity.isScalar(node) ? stringifyString.stringifyString(node, ctx, onComment, onChompKeep) : node.toString(ctx, onComment, onChompKeep);
      if (!props)
        return str;
      return identity.isScalar(node) || str[0] === "{" || str[0] === "[" ? `${props} ${str}` : `${props}
${ctx.indent}${str}`;
    }
    exports.createStringifyContext = createStringifyContext;
    exports.stringify = stringify;
  }
});

// node_modules/yaml/dist/stringify/stringifyPair.js
var require_stringifyPair = __commonJS({
  "node_modules/yaml/dist/stringify/stringifyPair.js"(exports) {
    "use strict";
    var identity = require_identity();
    var Scalar = require_Scalar();
    var stringify = require_stringify();
    var stringifyComment = require_stringifyComment();
    function stringifyPair({ key, value }, ctx, onComment, onChompKeep) {
      const { allNullValues, doc, indent, indentStep, options: { commentString, indentSeq, simpleKeys } } = ctx;
      let keyComment = identity.isNode(key) && key.comment || null;
      if (simpleKeys) {
        if (keyComment) {
          throw new Error("With simple keys, key nodes cannot have comments");
        }
        if (identity.isCollection(key) || !identity.isNode(key) && typeof key === "object") {
          const msg = "With simple keys, collection cannot be used as a key value";
          throw new Error(msg);
        }
      }
      let explicitKey = !simpleKeys && (!key || keyComment && value == null && !ctx.inFlow || identity.isCollection(key) || (identity.isScalar(key) ? key.type === Scalar.Scalar.BLOCK_FOLDED || key.type === Scalar.Scalar.BLOCK_LITERAL : typeof key === "object"));
      ctx = Object.assign({}, ctx, {
        allNullValues: false,
        implicitKey: !explicitKey && (simpleKeys || !allNullValues),
        indent: indent + indentStep
      });
      let keyCommentDone = false;
      let chompKeep = false;
      let str = stringify.stringify(key, ctx, () => keyCommentDone = true, () => chompKeep = true);
      if (!explicitKey && !ctx.inFlow && str.length > 1024) {
        if (simpleKeys)
          throw new Error("With simple keys, single line scalar must not span more than 1024 characters");
        explicitKey = true;
      }
      if (ctx.inFlow) {
        if (allNullValues || value == null) {
          if (keyCommentDone && onComment)
            onComment();
          return str === "" ? "?" : explicitKey ? `? ${str}` : str;
        }
      } else if (allNullValues && !simpleKeys || value == null && explicitKey) {
        str = `? ${str}`;
        if (keyComment && !keyCommentDone) {
          str += stringifyComment.lineComment(str, ctx.indent, commentString(keyComment));
        } else if (chompKeep && onChompKeep)
          onChompKeep();
        return str;
      }
      if (keyCommentDone)
        keyComment = null;
      if (explicitKey) {
        if (keyComment)
          str += stringifyComment.lineComment(str, ctx.indent, commentString(keyComment));
        str = `? ${str}
${indent}:`;
      } else {
        str = `${str}:`;
        if (keyComment)
          str += stringifyComment.lineComment(str, ctx.indent, commentString(keyComment));
      }
      let vsb, vcb, valueComment;
      if (identity.isNode(value)) {
        vsb = !!value.spaceBefore;
        vcb = value.commentBefore;
        valueComment = value.comment;
      } else {
        vsb = false;
        vcb = null;
        valueComment = null;
        if (value && typeof value === "object")
          value = doc.createNode(value);
      }
      ctx.implicitKey = false;
      if (!explicitKey && !keyComment && identity.isScalar(value))
        ctx.indentAtStart = str.length + 1;
      chompKeep = false;
      if (!indentSeq && indentStep.length >= 2 && !ctx.inFlow && !explicitKey && identity.isSeq(value) && !value.flow && !value.tag && !value.anchor) {
        ctx.indent = ctx.indent.substring(2);
      }
      let valueCommentDone = false;
      const valueStr = stringify.stringify(value, ctx, () => valueCommentDone = true, () => chompKeep = true);
      let ws = " ";
      if (keyComment || vsb || vcb) {
        ws = vsb ? "\n" : "";
        if (vcb) {
          const cs = commentString(vcb);
          ws += `
${stringifyComment.indentComment(cs, ctx.indent)}`;
        }
        if (valueStr === "" && !ctx.inFlow) {
          if (ws === "\n" && valueComment)
            ws = "\n\n";
        } else {
          ws += `
${ctx.indent}`;
        }
      } else if (!explicitKey && identity.isCollection(value)) {
        const vs0 = valueStr[0];
        const nl0 = valueStr.indexOf("\n");
        const hasNewline = nl0 !== -1;
        const flow = ctx.inFlow ?? value.flow ?? value.items.length === 0;
        if (hasNewline || !flow) {
          let hasPropsLine = false;
          if (hasNewline && (vs0 === "&" || vs0 === "!")) {
            let sp0 = valueStr.indexOf(" ");
            if (vs0 === "&" && sp0 !== -1 && sp0 < nl0 && valueStr[sp0 + 1] === "!") {
              sp0 = valueStr.indexOf(" ", sp0 + 1);
            }
            if (sp0 === -1 || nl0 < sp0)
              hasPropsLine = true;
          }
          if (!hasPropsLine)
            ws = `
${ctx.indent}`;
        }
      } else if (valueStr === "" || valueStr[0] === "\n") {
        ws = "";
      }
      str += ws + valueStr;
      if (ctx.inFlow) {
        if (valueCommentDone && onComment)
          onComment();
      } else if (valueComment && !valueCommentDone) {
        str += stringifyComment.lineComment(str, ctx.indent, commentString(valueComment));
      } else if (chompKeep && onChompKeep) {
        onChompKeep();
      }
      return str;
    }
    exports.stringifyPair = stringifyPair;
  }
});

// node_modules/yaml/dist/log.js
var require_log = __commonJS({
  "node_modules/yaml/dist/log.js"(exports) {
    "use strict";
    var node_process = __require("process");
    function debug(logLevel, ...messages) {
      if (logLevel === "debug")
        console.log(...messages);
    }
    function warn(logLevel, warning) {
      if (logLevel === "debug" || logLevel === "warn") {
        if (typeof node_process.emitWarning === "function")
          node_process.emitWarning(warning);
        else
          console.warn(warning);
      }
    }
    exports.debug = debug;
    exports.warn = warn;
  }
});

// node_modules/yaml/dist/schema/yaml-1.1/merge.js
var require_merge = __commonJS({
  "node_modules/yaml/dist/schema/yaml-1.1/merge.js"(exports) {
    "use strict";
    var identity = require_identity();
    var Scalar = require_Scalar();
    var MERGE_KEY = "<<";
    var merge = {
      identify: (value) => value === MERGE_KEY || typeof value === "symbol" && value.description === MERGE_KEY,
      default: "key",
      tag: "tag:yaml.org,2002:merge",
      test: /^<<$/,
      resolve: () => Object.assign(new Scalar.Scalar(Symbol(MERGE_KEY)), {
        addToJSMap: addMergeToJSMap
      }),
      stringify: () => MERGE_KEY
    };
    var isMergeKey = (ctx, key) => (merge.identify(key) || identity.isScalar(key) && (!key.type || key.type === Scalar.Scalar.PLAIN) && merge.identify(key.value)) && ctx?.doc.schema.tags.some((tag) => tag.tag === merge.tag && tag.default);
    function addMergeToJSMap(ctx, map, value) {
      value = ctx && identity.isAlias(value) ? value.resolve(ctx.doc) : value;
      if (identity.isSeq(value))
        for (const it of value.items)
          mergeValue(ctx, map, it);
      else if (Array.isArray(value))
        for (const it of value)
          mergeValue(ctx, map, it);
      else
        mergeValue(ctx, map, value);
    }
    function mergeValue(ctx, map, value) {
      const source = ctx && identity.isAlias(value) ? value.resolve(ctx.doc) : value;
      if (!identity.isMap(source))
        throw new Error("Merge sources must be maps or map aliases");
      const srcMap = source.toJSON(null, ctx, Map);
      for (const [key, value2] of srcMap) {
        if (map instanceof Map) {
          if (!map.has(key))
            map.set(key, value2);
        } else if (map instanceof Set) {
          map.add(key);
        } else if (!Object.prototype.hasOwnProperty.call(map, key)) {
          Object.defineProperty(map, key, {
            value: value2,
            writable: true,
            enumerable: true,
            configurable: true
          });
        }
      }
      return map;
    }
    exports.addMergeToJSMap = addMergeToJSMap;
    exports.isMergeKey = isMergeKey;
    exports.merge = merge;
  }
});

// node_modules/yaml/dist/nodes/addPairToJSMap.js
var require_addPairToJSMap = __commonJS({
  "node_modules/yaml/dist/nodes/addPairToJSMap.js"(exports) {
    "use strict";
    var log = require_log();
    var merge = require_merge();
    var stringify = require_stringify();
    var identity = require_identity();
    var toJS = require_toJS();
    function addPairToJSMap(ctx, map, { key, value }) {
      if (identity.isNode(key) && key.addToJSMap)
        key.addToJSMap(ctx, map, value);
      else if (merge.isMergeKey(ctx, key))
        merge.addMergeToJSMap(ctx, map, value);
      else {
        const jsKey = toJS.toJS(key, "", ctx);
        if (map instanceof Map) {
          map.set(jsKey, toJS.toJS(value, jsKey, ctx));
        } else if (map instanceof Set) {
          map.add(jsKey);
        } else {
          const stringKey = stringifyKey(key, jsKey, ctx);
          const jsValue = toJS.toJS(value, stringKey, ctx);
          if (stringKey in map)
            Object.defineProperty(map, stringKey, {
              value: jsValue,
              writable: true,
              enumerable: true,
              configurable: true
            });
          else
            map[stringKey] = jsValue;
        }
      }
      return map;
    }
    function stringifyKey(key, jsKey, ctx) {
      if (jsKey === null)
        return "";
      if (typeof jsKey !== "object")
        return String(jsKey);
      if (identity.isNode(key) && ctx?.doc) {
        const strCtx = stringify.createStringifyContext(ctx.doc, {});
        strCtx.anchors = /* @__PURE__ */ new Set();
        for (const node of ctx.anchors.keys())
          strCtx.anchors.add(node.anchor);
        strCtx.inFlow = true;
        strCtx.inStringifyKey = true;
        const strKey = key.toString(strCtx);
        if (!ctx.mapKeyWarned) {
          let jsonStr = JSON.stringify(strKey);
          if (jsonStr.length > 40)
            jsonStr = jsonStr.substring(0, 36) + '..."';
          log.warn(ctx.doc.options.logLevel, `Keys with collection values will be stringified due to JS Object restrictions: ${jsonStr}. Set mapAsMap: true to use object keys.`);
          ctx.mapKeyWarned = true;
        }
        return strKey;
      }
      return JSON.stringify(jsKey);
    }
    exports.addPairToJSMap = addPairToJSMap;
  }
});

// node_modules/yaml/dist/nodes/Pair.js
var require_Pair = __commonJS({
  "node_modules/yaml/dist/nodes/Pair.js"(exports) {
    "use strict";
    var createNode = require_createNode();
    var stringifyPair = require_stringifyPair();
    var addPairToJSMap = require_addPairToJSMap();
    var identity = require_identity();
    function createPair(key, value, ctx) {
      const k = createNode.createNode(key, void 0, ctx);
      const v = createNode.createNode(value, void 0, ctx);
      return new Pair(k, v);
    }
    var Pair = class _Pair {
      constructor(key, value = null) {
        Object.defineProperty(this, identity.NODE_TYPE, { value: identity.PAIR });
        this.key = key;
        this.value = value;
      }
      clone(schema) {
        let { key, value } = this;
        if (identity.isNode(key))
          key = key.clone(schema);
        if (identity.isNode(value))
          value = value.clone(schema);
        return new _Pair(key, value);
      }
      toJSON(_, ctx) {
        const pair = ctx?.mapAsMap ? /* @__PURE__ */ new Map() : {};
        return addPairToJSMap.addPairToJSMap(ctx, pair, this);
      }
      toString(ctx, onComment, onChompKeep) {
        return ctx?.doc ? stringifyPair.stringifyPair(this, ctx, onComment, onChompKeep) : JSON.stringify(this);
      }
    };
    exports.Pair = Pair;
    exports.createPair = createPair;
  }
});

// node_modules/yaml/dist/stringify/stringifyCollection.js
var require_stringifyCollection = __commonJS({
  "node_modules/yaml/dist/stringify/stringifyCollection.js"(exports) {
    "use strict";
    var identity = require_identity();
    var stringify = require_stringify();
    var stringifyComment = require_stringifyComment();
    function stringifyCollection(collection, ctx, options) {
      const flow = ctx.inFlow ?? collection.flow;
      const stringify2 = flow ? stringifyFlowCollection : stringifyBlockCollection;
      return stringify2(collection, ctx, options);
    }
    function stringifyBlockCollection({ comment, items }, ctx, { blockItemPrefix, flowChars, itemIndent, onChompKeep, onComment }) {
      const { indent, options: { commentString } } = ctx;
      const itemCtx = Object.assign({}, ctx, { indent: itemIndent, type: null });
      let chompKeep = false;
      const lines = [];
      for (let i = 0; i < items.length; ++i) {
        const item = items[i];
        let comment2 = null;
        if (identity.isNode(item)) {
          if (!chompKeep && item.spaceBefore)
            lines.push("");
          addCommentBefore(ctx, lines, item.commentBefore, chompKeep);
          if (item.comment)
            comment2 = item.comment;
        } else if (identity.isPair(item)) {
          const ik = identity.isNode(item.key) ? item.key : null;
          if (ik) {
            if (!chompKeep && ik.spaceBefore)
              lines.push("");
            addCommentBefore(ctx, lines, ik.commentBefore, chompKeep);
          }
        }
        chompKeep = false;
        let str2 = stringify.stringify(item, itemCtx, () => comment2 = null, () => chompKeep = true);
        if (comment2)
          str2 += stringifyComment.lineComment(str2, itemIndent, commentString(comment2));
        if (chompKeep && comment2)
          chompKeep = false;
        lines.push(blockItemPrefix + str2);
      }
      let str;
      if (lines.length === 0) {
        str = flowChars.start + flowChars.end;
      } else {
        str = lines[0];
        for (let i = 1; i < lines.length; ++i) {
          const line = lines[i];
          str += line ? `
${indent}${line}` : "\n";
        }
      }
      if (comment) {
        str += "\n" + stringifyComment.indentComment(commentString(comment), indent);
        if (onComment)
          onComment();
      } else if (chompKeep && onChompKeep)
        onChompKeep();
      return str;
    }
    function stringifyFlowCollection({ items }, ctx, { flowChars, itemIndent }) {
      const { indent, indentStep, flowCollectionPadding: fcPadding, options: { commentString } } = ctx;
      itemIndent += indentStep;
      const itemCtx = Object.assign({}, ctx, {
        indent: itemIndent,
        inFlow: true,
        type: null
      });
      let reqNewline = false;
      let linesAtValue = 0;
      const lines = [];
      for (let i = 0; i < items.length; ++i) {
        const item = items[i];
        let comment = null;
        if (identity.isNode(item)) {
          if (item.spaceBefore)
            lines.push("");
          addCommentBefore(ctx, lines, item.commentBefore, false);
          if (item.comment)
            comment = item.comment;
        } else if (identity.isPair(item)) {
          const ik = identity.isNode(item.key) ? item.key : null;
          if (ik) {
            if (ik.spaceBefore)
              lines.push("");
            addCommentBefore(ctx, lines, ik.commentBefore, false);
            if (ik.comment)
              reqNewline = true;
          }
          const iv = identity.isNode(item.value) ? item.value : null;
          if (iv) {
            if (iv.comment)
              comment = iv.comment;
            if (iv.commentBefore)
              reqNewline = true;
          } else if (item.value == null && ik?.comment) {
            comment = ik.comment;
          }
        }
        if (comment)
          reqNewline = true;
        let str = stringify.stringify(item, itemCtx, () => comment = null);
        reqNewline || (reqNewline = lines.length > linesAtValue || str.includes("\n"));
        if (i < items.length - 1) {
          str += ",";
        } else if (ctx.options.trailingComma) {
          if (ctx.options.lineWidth > 0) {
            reqNewline || (reqNewline = lines.reduce((sum, line) => sum + line.length + 2, 2) + (str.length + 2) > ctx.options.lineWidth);
          }
          if (reqNewline) {
            str += ",";
          }
        }
        if (comment)
          str += stringifyComment.lineComment(str, itemIndent, commentString(comment));
        lines.push(str);
        linesAtValue = lines.length;
      }
      const { start, end } = flowChars;
      if (lines.length === 0) {
        return start + end;
      } else {
        if (!reqNewline) {
          const len = lines.reduce((sum, line) => sum + line.length + 2, 2);
          reqNewline = ctx.options.lineWidth > 0 && len > ctx.options.lineWidth;
        }
        if (reqNewline) {
          let str = start;
          for (const line of lines)
            str += line ? `
${indentStep}${indent}${line}` : "\n";
          return `${str}
${indent}${end}`;
        } else {
          return `${start}${fcPadding}${lines.join(" ")}${fcPadding}${end}`;
        }
      }
    }
    function addCommentBefore({ indent, options: { commentString } }, lines, comment, chompKeep) {
      if (comment && chompKeep)
        comment = comment.replace(/^\n+/, "");
      if (comment) {
        const ic = stringifyComment.indentComment(commentString(comment), indent);
        lines.push(ic.trimStart());
      }
    }
    exports.stringifyCollection = stringifyCollection;
  }
});

// node_modules/yaml/dist/nodes/YAMLMap.js
var require_YAMLMap = __commonJS({
  "node_modules/yaml/dist/nodes/YAMLMap.js"(exports) {
    "use strict";
    var stringifyCollection = require_stringifyCollection();
    var addPairToJSMap = require_addPairToJSMap();
    var Collection = require_Collection();
    var identity = require_identity();
    var Pair = require_Pair();
    var Scalar = require_Scalar();
    function findPair(items, key) {
      const k = identity.isScalar(key) ? key.value : key;
      for (const it of items) {
        if (identity.isPair(it)) {
          if (it.key === key || it.key === k)
            return it;
          if (identity.isScalar(it.key) && it.key.value === k)
            return it;
        }
      }
      return void 0;
    }
    var YAMLMap = class extends Collection.Collection {
      static get tagName() {
        return "tag:yaml.org,2002:map";
      }
      constructor(schema) {
        super(identity.MAP, schema);
        this.items = [];
      }
      /**
       * A generic collection parsing method that can be extended
       * to other node classes that inherit from YAMLMap
       */
      static from(schema, obj, ctx) {
        const { keepUndefined, replacer } = ctx;
        const map = new this(schema);
        const add = (key, value) => {
          if (typeof replacer === "function")
            value = replacer.call(obj, key, value);
          else if (Array.isArray(replacer) && !replacer.includes(key))
            return;
          if (value !== void 0 || keepUndefined)
            map.items.push(Pair.createPair(key, value, ctx));
        };
        if (obj instanceof Map) {
          for (const [key, value] of obj)
            add(key, value);
        } else if (obj && typeof obj === "object") {
          for (const key of Object.keys(obj))
            add(key, obj[key]);
        }
        if (typeof schema.sortMapEntries === "function") {
          map.items.sort(schema.sortMapEntries);
        }
        return map;
      }
      /**
       * Adds a value to the collection.
       *
       * @param overwrite - If not set `true`, using a key that is already in the
       *   collection will throw. Otherwise, overwrites the previous value.
       */
      add(pair, overwrite) {
        let _pair;
        if (identity.isPair(pair))
          _pair = pair;
        else if (!pair || typeof pair !== "object" || !("key" in pair)) {
          _pair = new Pair.Pair(pair, pair?.value);
        } else
          _pair = new Pair.Pair(pair.key, pair.value);
        const prev = findPair(this.items, _pair.key);
        const sortEntries = this.schema?.sortMapEntries;
        if (prev) {
          if (!overwrite)
            throw new Error(`Key ${_pair.key} already set`);
          if (identity.isScalar(prev.value) && Scalar.isScalarValue(_pair.value))
            prev.value.value = _pair.value;
          else
            prev.value = _pair.value;
        } else if (sortEntries) {
          const i = this.items.findIndex((item) => sortEntries(_pair, item) < 0);
          if (i === -1)
            this.items.push(_pair);
          else
            this.items.splice(i, 0, _pair);
        } else {
          this.items.push(_pair);
        }
      }
      delete(key) {
        const it = findPair(this.items, key);
        if (!it)
          return false;
        const del = this.items.splice(this.items.indexOf(it), 1);
        return del.length > 0;
      }
      get(key, keepScalar) {
        const it = findPair(this.items, key);
        const node = it?.value;
        return (!keepScalar && identity.isScalar(node) ? node.value : node) ?? void 0;
      }
      has(key) {
        return !!findPair(this.items, key);
      }
      set(key, value) {
        this.add(new Pair.Pair(key, value), true);
      }
      /**
       * @param ctx - Conversion context, originally set in Document#toJS()
       * @param {Class} Type - If set, forces the returned collection type
       * @returns Instance of Type, Map, or Object
       */
      toJSON(_, ctx, Type) {
        const map = Type ? new Type() : ctx?.mapAsMap ? /* @__PURE__ */ new Map() : {};
        if (ctx?.onCreate)
          ctx.onCreate(map);
        for (const item of this.items)
          addPairToJSMap.addPairToJSMap(ctx, map, item);
        return map;
      }
      toString(ctx, onComment, onChompKeep) {
        if (!ctx)
          return JSON.stringify(this);
        for (const item of this.items) {
          if (!identity.isPair(item))
            throw new Error(`Map items must all be pairs; found ${JSON.stringify(item)} instead`);
        }
        if (!ctx.allNullValues && this.hasAllNullValues(false))
          ctx = Object.assign({}, ctx, { allNullValues: true });
        return stringifyCollection.stringifyCollection(this, ctx, {
          blockItemPrefix: "",
          flowChars: { start: "{", end: "}" },
          itemIndent: ctx.indent || "",
          onChompKeep,
          onComment
        });
      }
    };
    exports.YAMLMap = YAMLMap;
    exports.findPair = findPair;
  }
});

// node_modules/yaml/dist/schema/common/map.js
var require_map = __commonJS({
  "node_modules/yaml/dist/schema/common/map.js"(exports) {
    "use strict";
    var identity = require_identity();
    var YAMLMap = require_YAMLMap();
    var map = {
      collection: "map",
      default: true,
      nodeClass: YAMLMap.YAMLMap,
      tag: "tag:yaml.org,2002:map",
      resolve(map2, onError) {
        if (!identity.isMap(map2))
          onError("Expected a mapping for this tag");
        return map2;
      },
      createNode: (schema, obj, ctx) => YAMLMap.YAMLMap.from(schema, obj, ctx)
    };
    exports.map = map;
  }
});

// node_modules/yaml/dist/nodes/YAMLSeq.js
var require_YAMLSeq = __commonJS({
  "node_modules/yaml/dist/nodes/YAMLSeq.js"(exports) {
    "use strict";
    var createNode = require_createNode();
    var stringifyCollection = require_stringifyCollection();
    var Collection = require_Collection();
    var identity = require_identity();
    var Scalar = require_Scalar();
    var toJS = require_toJS();
    var YAMLSeq = class extends Collection.Collection {
      static get tagName() {
        return "tag:yaml.org,2002:seq";
      }
      constructor(schema) {
        super(identity.SEQ, schema);
        this.items = [];
      }
      add(value) {
        this.items.push(value);
      }
      /**
       * Removes a value from the collection.
       *
       * `key` must contain a representation of an integer for this to succeed.
       * It may be wrapped in a `Scalar`.
       *
       * @returns `true` if the item was found and removed.
       */
      delete(key) {
        const idx = asItemIndex(key);
        if (typeof idx !== "number")
          return false;
        const del = this.items.splice(idx, 1);
        return del.length > 0;
      }
      get(key, keepScalar) {
        const idx = asItemIndex(key);
        if (typeof idx !== "number")
          return void 0;
        const it = this.items[idx];
        return !keepScalar && identity.isScalar(it) ? it.value : it;
      }
      /**
       * Checks if the collection includes a value with the key `key`.
       *
       * `key` must contain a representation of an integer for this to succeed.
       * It may be wrapped in a `Scalar`.
       */
      has(key) {
        const idx = asItemIndex(key);
        return typeof idx === "number" && idx < this.items.length;
      }
      /**
       * Sets a value in this collection. For `!!set`, `value` needs to be a
       * boolean to add/remove the item from the set.
       *
       * If `key` does not contain a representation of an integer, this will throw.
       * It may be wrapped in a `Scalar`.
       */
      set(key, value) {
        const idx = asItemIndex(key);
        if (typeof idx !== "number")
          throw new Error(`Expected a valid index, not ${key}.`);
        const prev = this.items[idx];
        if (identity.isScalar(prev) && Scalar.isScalarValue(value))
          prev.value = value;
        else
          this.items[idx] = value;
      }
      toJSON(_, ctx) {
        const seq = [];
        if (ctx?.onCreate)
          ctx.onCreate(seq);
        let i = 0;
        for (const item of this.items)
          seq.push(toJS.toJS(item, String(i++), ctx));
        return seq;
      }
      toString(ctx, onComment, onChompKeep) {
        if (!ctx)
          return JSON.stringify(this);
        return stringifyCollection.stringifyCollection(this, ctx, {
          blockItemPrefix: "- ",
          flowChars: { start: "[", end: "]" },
          itemIndent: (ctx.indent || "") + "  ",
          onChompKeep,
          onComment
        });
      }
      static from(schema, obj, ctx) {
        const { replacer } = ctx;
        const seq = new this(schema);
        if (obj && Symbol.iterator in Object(obj)) {
          let i = 0;
          for (let it of obj) {
            if (typeof replacer === "function") {
              const key = obj instanceof Set ? it : String(i++);
              it = replacer.call(obj, key, it);
            }
            seq.items.push(createNode.createNode(it, void 0, ctx));
          }
        }
        return seq;
      }
    };
    function asItemIndex(key) {
      let idx = identity.isScalar(key) ? key.value : key;
      if (idx && typeof idx === "string")
        idx = Number(idx);
      return typeof idx === "number" && Number.isInteger(idx) && idx >= 0 ? idx : null;
    }
    exports.YAMLSeq = YAMLSeq;
  }
});

// node_modules/yaml/dist/schema/common/seq.js
var require_seq = __commonJS({
  "node_modules/yaml/dist/schema/common/seq.js"(exports) {
    "use strict";
    var identity = require_identity();
    var YAMLSeq = require_YAMLSeq();
    var seq = {
      collection: "seq",
      default: true,
      nodeClass: YAMLSeq.YAMLSeq,
      tag: "tag:yaml.org,2002:seq",
      resolve(seq2, onError) {
        if (!identity.isSeq(seq2))
          onError("Expected a sequence for this tag");
        return seq2;
      },
      createNode: (schema, obj, ctx) => YAMLSeq.YAMLSeq.from(schema, obj, ctx)
    };
    exports.seq = seq;
  }
});

// node_modules/yaml/dist/schema/common/string.js
var require_string = __commonJS({
  "node_modules/yaml/dist/schema/common/string.js"(exports) {
    "use strict";
    var stringifyString = require_stringifyString();
    var string = {
      identify: (value) => typeof value === "string",
      default: true,
      tag: "tag:yaml.org,2002:str",
      resolve: (str) => str,
      stringify(item, ctx, onComment, onChompKeep) {
        ctx = Object.assign({ actualString: true }, ctx);
        return stringifyString.stringifyString(item, ctx, onComment, onChompKeep);
      }
    };
    exports.string = string;
  }
});

// node_modules/yaml/dist/schema/common/null.js
var require_null = __commonJS({
  "node_modules/yaml/dist/schema/common/null.js"(exports) {
    "use strict";
    var Scalar = require_Scalar();
    var nullTag = {
      identify: (value) => value == null,
      createNode: () => new Scalar.Scalar(null),
      default: true,
      tag: "tag:yaml.org,2002:null",
      test: /^(?:~|[Nn]ull|NULL)?$/,
      resolve: () => new Scalar.Scalar(null),
      stringify: ({ source }, ctx) => typeof source === "string" && nullTag.test.test(source) ? source : ctx.options.nullStr
    };
    exports.nullTag = nullTag;
  }
});

// node_modules/yaml/dist/schema/core/bool.js
var require_bool = __commonJS({
  "node_modules/yaml/dist/schema/core/bool.js"(exports) {
    "use strict";
    var Scalar = require_Scalar();
    var boolTag = {
      identify: (value) => typeof value === "boolean",
      default: true,
      tag: "tag:yaml.org,2002:bool",
      test: /^(?:[Tt]rue|TRUE|[Ff]alse|FALSE)$/,
      resolve: (str) => new Scalar.Scalar(str[0] === "t" || str[0] === "T"),
      stringify({ source, value }, ctx) {
        if (source && boolTag.test.test(source)) {
          const sv = source[0] === "t" || source[0] === "T";
          if (value === sv)
            return source;
        }
        return value ? ctx.options.trueStr : ctx.options.falseStr;
      }
    };
    exports.boolTag = boolTag;
  }
});

// node_modules/yaml/dist/stringify/stringifyNumber.js
var require_stringifyNumber = __commonJS({
  "node_modules/yaml/dist/stringify/stringifyNumber.js"(exports) {
    "use strict";
    function stringifyNumber({ format, minFractionDigits, tag, value }) {
      if (typeof value === "bigint")
        return String(value);
      const num = typeof value === "number" ? value : Number(value);
      if (!isFinite(num))
        return isNaN(num) ? ".nan" : num < 0 ? "-.inf" : ".inf";
      let n = Object.is(value, -0) ? "-0" : JSON.stringify(value);
      if (!format && minFractionDigits && (!tag || tag === "tag:yaml.org,2002:float") && /^\d/.test(n)) {
        let i = n.indexOf(".");
        if (i < 0) {
          i = n.length;
          n += ".";
        }
        let d = minFractionDigits - (n.length - i - 1);
        while (d-- > 0)
          n += "0";
      }
      return n;
    }
    exports.stringifyNumber = stringifyNumber;
  }
});

// node_modules/yaml/dist/schema/core/float.js
var require_float = __commonJS({
  "node_modules/yaml/dist/schema/core/float.js"(exports) {
    "use strict";
    var Scalar = require_Scalar();
    var stringifyNumber = require_stringifyNumber();
    var floatNaN = {
      identify: (value) => typeof value === "number",
      default: true,
      tag: "tag:yaml.org,2002:float",
      test: /^(?:[-+]?\.(?:inf|Inf|INF)|\.nan|\.NaN|\.NAN)$/,
      resolve: (str) => str.slice(-3).toLowerCase() === "nan" ? NaN : str[0] === "-" ? Number.NEGATIVE_INFINITY : Number.POSITIVE_INFINITY,
      stringify: stringifyNumber.stringifyNumber
    };
    var floatExp = {
      identify: (value) => typeof value === "number",
      default: true,
      tag: "tag:yaml.org,2002:float",
      format: "EXP",
      test: /^[-+]?(?:\.[0-9]+|[0-9]+(?:\.[0-9]*)?)[eE][-+]?[0-9]+$/,
      resolve: (str) => parseFloat(str),
      stringify(node) {
        const num = Number(node.value);
        return isFinite(num) ? num.toExponential() : stringifyNumber.stringifyNumber(node);
      }
    };
    var float = {
      identify: (value) => typeof value === "number",
      default: true,
      tag: "tag:yaml.org,2002:float",
      test: /^[-+]?(?:\.[0-9]+|[0-9]+\.[0-9]*)$/,
      resolve(str) {
        const node = new Scalar.Scalar(parseFloat(str));
        const dot = str.indexOf(".");
        if (dot !== -1 && str[str.length - 1] === "0")
          node.minFractionDigits = str.length - dot - 1;
        return node;
      },
      stringify: stringifyNumber.stringifyNumber
    };
    exports.float = float;
    exports.floatExp = floatExp;
    exports.floatNaN = floatNaN;
  }
});

// node_modules/yaml/dist/schema/core/int.js
var require_int = __commonJS({
  "node_modules/yaml/dist/schema/core/int.js"(exports) {
    "use strict";
    var stringifyNumber = require_stringifyNumber();
    var intIdentify = (value) => typeof value === "bigint" || Number.isInteger(value);
    var intResolve = (str, offset, radix, { intAsBigInt }) => intAsBigInt ? BigInt(str) : parseInt(str.substring(offset), radix);
    function intStringify(node, radix, prefix) {
      const { value } = node;
      if (intIdentify(value) && value >= 0)
        return prefix + value.toString(radix);
      return stringifyNumber.stringifyNumber(node);
    }
    var intOct = {
      identify: (value) => intIdentify(value) && value >= 0,
      default: true,
      tag: "tag:yaml.org,2002:int",
      format: "OCT",
      test: /^0o[0-7]+$/,
      resolve: (str, _onError, opt) => intResolve(str, 2, 8, opt),
      stringify: (node) => intStringify(node, 8, "0o")
    };
    var int = {
      identify: intIdentify,
      default: true,
      tag: "tag:yaml.org,2002:int",
      test: /^[-+]?[0-9]+$/,
      resolve: (str, _onError, opt) => intResolve(str, 0, 10, opt),
      stringify: stringifyNumber.stringifyNumber
    };
    var intHex = {
      identify: (value) => intIdentify(value) && value >= 0,
      default: true,
      tag: "tag:yaml.org,2002:int",
      format: "HEX",
      test: /^0x[0-9a-fA-F]+$/,
      resolve: (str, _onError, opt) => intResolve(str, 2, 16, opt),
      stringify: (node) => intStringify(node, 16, "0x")
    };
    exports.int = int;
    exports.intHex = intHex;
    exports.intOct = intOct;
  }
});

// node_modules/yaml/dist/schema/core/schema.js
var require_schema = __commonJS({
  "node_modules/yaml/dist/schema/core/schema.js"(exports) {
    "use strict";
    var map = require_map();
    var _null = require_null();
    var seq = require_seq();
    var string = require_string();
    var bool = require_bool();
    var float = require_float();
    var int = require_int();
    var schema = [
      map.map,
      seq.seq,
      string.string,
      _null.nullTag,
      bool.boolTag,
      int.intOct,
      int.int,
      int.intHex,
      float.floatNaN,
      float.floatExp,
      float.float
    ];
    exports.schema = schema;
  }
});

// node_modules/yaml/dist/schema/json/schema.js
var require_schema2 = __commonJS({
  "node_modules/yaml/dist/schema/json/schema.js"(exports) {
    "use strict";
    var Scalar = require_Scalar();
    var map = require_map();
    var seq = require_seq();
    function intIdentify(value) {
      return typeof value === "bigint" || Number.isInteger(value);
    }
    var stringifyJSON = ({ value }) => JSON.stringify(value);
    var jsonScalars = [
      {
        identify: (value) => typeof value === "string",
        default: true,
        tag: "tag:yaml.org,2002:str",
        resolve: (str) => str,
        stringify: stringifyJSON
      },
      {
        identify: (value) => value == null,
        createNode: () => new Scalar.Scalar(null),
        default: true,
        tag: "tag:yaml.org,2002:null",
        test: /^null$/,
        resolve: () => null,
        stringify: stringifyJSON
      },
      {
        identify: (value) => typeof value === "boolean",
        default: true,
        tag: "tag:yaml.org,2002:bool",
        test: /^true$|^false$/,
        resolve: (str) => str === "true",
        stringify: stringifyJSON
      },
      {
        identify: intIdentify,
        default: true,
        tag: "tag:yaml.org,2002:int",
        test: /^-?(?:0|[1-9][0-9]*)$/,
        resolve: (str, _onError, { intAsBigInt }) => intAsBigInt ? BigInt(str) : parseInt(str, 10),
        stringify: ({ value }) => intIdentify(value) ? value.toString() : JSON.stringify(value)
      },
      {
        identify: (value) => typeof value === "number",
        default: true,
        tag: "tag:yaml.org,2002:float",
        test: /^-?(?:0|[1-9][0-9]*)(?:\.[0-9]*)?(?:[eE][-+]?[0-9]+)?$/,
        resolve: (str) => parseFloat(str),
        stringify: stringifyJSON
      }
    ];
    var jsonError = {
      default: true,
      tag: "",
      test: /^/,
      resolve(str, onError) {
        onError(`Unresolved plain scalar ${JSON.stringify(str)}`);
        return str;
      }
    };
    var schema = [map.map, seq.seq].concat(jsonScalars, jsonError);
    exports.schema = schema;
  }
});

// node_modules/yaml/dist/schema/yaml-1.1/binary.js
var require_binary = __commonJS({
  "node_modules/yaml/dist/schema/yaml-1.1/binary.js"(exports) {
    "use strict";
    var node_buffer = __require("buffer");
    var Scalar = require_Scalar();
    var stringifyString = require_stringifyString();
    var binary = {
      identify: (value) => value instanceof Uint8Array,
      // Buffer inherits from Uint8Array
      default: false,
      tag: "tag:yaml.org,2002:binary",
      /**
       * Returns a Buffer in node and an Uint8Array in browsers
       *
       * To use the resulting buffer as an image, you'll want to do something like:
       *
       *   const blob = new Blob([buffer], { type: 'image/jpeg' })
       *   document.querySelector('#photo').src = URL.createObjectURL(blob)
       */
      resolve(src, onError) {
        if (typeof node_buffer.Buffer === "function") {
          return node_buffer.Buffer.from(src, "base64");
        } else if (typeof atob === "function") {
          const str = atob(src.replace(/[\n\r]/g, ""));
          const buffer = new Uint8Array(str.length);
          for (let i = 0; i < str.length; ++i)
            buffer[i] = str.charCodeAt(i);
          return buffer;
        } else {
          onError("This environment does not support reading binary tags; either Buffer or atob is required");
          return src;
        }
      },
      stringify({ comment, type, value }, ctx, onComment, onChompKeep) {
        if (!value)
          return "";
        const buf = value;
        let str;
        if (typeof node_buffer.Buffer === "function") {
          str = buf instanceof node_buffer.Buffer ? buf.toString("base64") : node_buffer.Buffer.from(buf.buffer).toString("base64");
        } else if (typeof btoa === "function") {
          let s = "";
          for (let i = 0; i < buf.length; ++i)
            s += String.fromCharCode(buf[i]);
          str = btoa(s);
        } else {
          throw new Error("This environment does not support writing binary tags; either Buffer or btoa is required");
        }
        type ?? (type = Scalar.Scalar.BLOCK_LITERAL);
        if (type !== Scalar.Scalar.QUOTE_DOUBLE) {
          const lineWidth = Math.max(ctx.options.lineWidth - ctx.indent.length, ctx.options.minContentWidth);
          const n = Math.ceil(str.length / lineWidth);
          const lines = new Array(n);
          for (let i = 0, o = 0; i < n; ++i, o += lineWidth) {
            lines[i] = str.substr(o, lineWidth);
          }
          str = lines.join(type === Scalar.Scalar.BLOCK_LITERAL ? "\n" : " ");
        }
        return stringifyString.stringifyString({ comment, type, value: str }, ctx, onComment, onChompKeep);
      }
    };
    exports.binary = binary;
  }
});

// node_modules/yaml/dist/schema/yaml-1.1/pairs.js
var require_pairs = __commonJS({
  "node_modules/yaml/dist/schema/yaml-1.1/pairs.js"(exports) {
    "use strict";
    var identity = require_identity();
    var Pair = require_Pair();
    var Scalar = require_Scalar();
    var YAMLSeq = require_YAMLSeq();
    function resolvePairs(seq, onError) {
      if (identity.isSeq(seq)) {
        for (let i = 0; i < seq.items.length; ++i) {
          let item = seq.items[i];
          if (identity.isPair(item))
            continue;
          else if (identity.isMap(item)) {
            if (item.items.length > 1)
              onError("Each pair must have its own sequence indicator");
            const pair = item.items[0] || new Pair.Pair(new Scalar.Scalar(null));
            if (item.commentBefore)
              pair.key.commentBefore = pair.key.commentBefore ? `${item.commentBefore}
${pair.key.commentBefore}` : item.commentBefore;
            if (item.comment) {
              const cn = pair.value ?? pair.key;
              cn.comment = cn.comment ? `${item.comment}
${cn.comment}` : item.comment;
            }
            item = pair;
          }
          seq.items[i] = identity.isPair(item) ? item : new Pair.Pair(item);
        }
      } else
        onError("Expected a sequence for this tag");
      return seq;
    }
    function createPairs(schema, iterable, ctx) {
      const { replacer } = ctx;
      const pairs2 = new YAMLSeq.YAMLSeq(schema);
      pairs2.tag = "tag:yaml.org,2002:pairs";
      let i = 0;
      if (iterable && Symbol.iterator in Object(iterable))
        for (let it of iterable) {
          if (typeof replacer === "function")
            it = replacer.call(iterable, String(i++), it);
          let key, value;
          if (Array.isArray(it)) {
            if (it.length === 2) {
              key = it[0];
              value = it[1];
            } else
              throw new TypeError(`Expected [key, value] tuple: ${it}`);
          } else if (it && it instanceof Object) {
            const keys = Object.keys(it);
            if (keys.length === 1) {
              key = keys[0];
              value = it[key];
            } else {
              throw new TypeError(`Expected tuple with one key, not ${keys.length} keys`);
            }
          } else {
            key = it;
          }
          pairs2.items.push(Pair.createPair(key, value, ctx));
        }
      return pairs2;
    }
    var pairs = {
      collection: "seq",
      default: false,
      tag: "tag:yaml.org,2002:pairs",
      resolve: resolvePairs,
      createNode: createPairs
    };
    exports.createPairs = createPairs;
    exports.pairs = pairs;
    exports.resolvePairs = resolvePairs;
  }
});

// node_modules/yaml/dist/schema/yaml-1.1/omap.js
var require_omap = __commonJS({
  "node_modules/yaml/dist/schema/yaml-1.1/omap.js"(exports) {
    "use strict";
    var identity = require_identity();
    var toJS = require_toJS();
    var YAMLMap = require_YAMLMap();
    var YAMLSeq = require_YAMLSeq();
    var pairs = require_pairs();
    var YAMLOMap = class _YAMLOMap extends YAMLSeq.YAMLSeq {
      constructor() {
        super();
        this.add = YAMLMap.YAMLMap.prototype.add.bind(this);
        this.delete = YAMLMap.YAMLMap.prototype.delete.bind(this);
        this.get = YAMLMap.YAMLMap.prototype.get.bind(this);
        this.has = YAMLMap.YAMLMap.prototype.has.bind(this);
        this.set = YAMLMap.YAMLMap.prototype.set.bind(this);
        this.tag = _YAMLOMap.tag;
      }
      /**
       * If `ctx` is given, the return type is actually `Map<unknown, unknown>`,
       * but TypeScript won't allow widening the signature of a child method.
       */
      toJSON(_, ctx) {
        if (!ctx)
          return super.toJSON(_);
        const map = /* @__PURE__ */ new Map();
        if (ctx?.onCreate)
          ctx.onCreate(map);
        for (const pair of this.items) {
          let key, value;
          if (identity.isPair(pair)) {
            key = toJS.toJS(pair.key, "", ctx);
            value = toJS.toJS(pair.value, key, ctx);
          } else {
            key = toJS.toJS(pair, "", ctx);
          }
          if (map.has(key))
            throw new Error("Ordered maps must not include duplicate keys");
          map.set(key, value);
        }
        return map;
      }
      static from(schema, iterable, ctx) {
        const pairs$1 = pairs.createPairs(schema, iterable, ctx);
        const omap2 = new this();
        omap2.items = pairs$1.items;
        return omap2;
      }
    };
    YAMLOMap.tag = "tag:yaml.org,2002:omap";
    var omap = {
      collection: "seq",
      identify: (value) => value instanceof Map,
      nodeClass: YAMLOMap,
      default: false,
      tag: "tag:yaml.org,2002:omap",
      resolve(seq, onError) {
        const pairs$1 = pairs.resolvePairs(seq, onError);
        const seenKeys = [];
        for (const { key } of pairs$1.items) {
          if (identity.isScalar(key)) {
            if (seenKeys.includes(key.value)) {
              onError(`Ordered maps must not include duplicate keys: ${key.value}`);
            } else {
              seenKeys.push(key.value);
            }
          }
        }
        return Object.assign(new YAMLOMap(), pairs$1);
      },
      createNode: (schema, iterable, ctx) => YAMLOMap.from(schema, iterable, ctx)
    };
    exports.YAMLOMap = YAMLOMap;
    exports.omap = omap;
  }
});

// node_modules/yaml/dist/schema/yaml-1.1/bool.js
var require_bool2 = __commonJS({
  "node_modules/yaml/dist/schema/yaml-1.1/bool.js"(exports) {
    "use strict";
    var Scalar = require_Scalar();
    function boolStringify({ value, source }, ctx) {
      const boolObj = value ? trueTag : falseTag;
      if (source && boolObj.test.test(source))
        return source;
      return value ? ctx.options.trueStr : ctx.options.falseStr;
    }
    var trueTag = {
      identify: (value) => value === true,
      default: true,
      tag: "tag:yaml.org,2002:bool",
      test: /^(?:Y|y|[Yy]es|YES|[Tt]rue|TRUE|[Oo]n|ON)$/,
      resolve: () => new Scalar.Scalar(true),
      stringify: boolStringify
    };
    var falseTag = {
      identify: (value) => value === false,
      default: true,
      tag: "tag:yaml.org,2002:bool",
      test: /^(?:N|n|[Nn]o|NO|[Ff]alse|FALSE|[Oo]ff|OFF)$/,
      resolve: () => new Scalar.Scalar(false),
      stringify: boolStringify
    };
    exports.falseTag = falseTag;
    exports.trueTag = trueTag;
  }
});

// node_modules/yaml/dist/schema/yaml-1.1/float.js
var require_float2 = __commonJS({
  "node_modules/yaml/dist/schema/yaml-1.1/float.js"(exports) {
    "use strict";
    var Scalar = require_Scalar();
    var stringifyNumber = require_stringifyNumber();
    var floatNaN = {
      identify: (value) => typeof value === "number",
      default: true,
      tag: "tag:yaml.org,2002:float",
      test: /^(?:[-+]?\.(?:inf|Inf|INF)|\.nan|\.NaN|\.NAN)$/,
      resolve: (str) => str.slice(-3).toLowerCase() === "nan" ? NaN : str[0] === "-" ? Number.NEGATIVE_INFINITY : Number.POSITIVE_INFINITY,
      stringify: stringifyNumber.stringifyNumber
    };
    var floatExp = {
      identify: (value) => typeof value === "number",
      default: true,
      tag: "tag:yaml.org,2002:float",
      format: "EXP",
      test: /^[-+]?(?:[0-9][0-9_]*)?(?:\.[0-9_]*)?[eE][-+]?[0-9]+$/,
      resolve: (str) => parseFloat(str.replace(/_/g, "")),
      stringify(node) {
        const num = Number(node.value);
        return isFinite(num) ? num.toExponential() : stringifyNumber.stringifyNumber(node);
      }
    };
    var float = {
      identify: (value) => typeof value === "number",
      default: true,
      tag: "tag:yaml.org,2002:float",
      test: /^[-+]?(?:[0-9][0-9_]*)?\.[0-9_]*$/,
      resolve(str) {
        const node = new Scalar.Scalar(parseFloat(str.replace(/_/g, "")));
        const dot = str.indexOf(".");
        if (dot !== -1) {
          const f = str.substring(dot + 1).replace(/_/g, "");
          if (f[f.length - 1] === "0")
            node.minFractionDigits = f.length;
        }
        return node;
      },
      stringify: stringifyNumber.stringifyNumber
    };
    exports.float = float;
    exports.floatExp = floatExp;
    exports.floatNaN = floatNaN;
  }
});

// node_modules/yaml/dist/schema/yaml-1.1/int.js
var require_int2 = __commonJS({
  "node_modules/yaml/dist/schema/yaml-1.1/int.js"(exports) {
    "use strict";
    var stringifyNumber = require_stringifyNumber();
    var intIdentify = (value) => typeof value === "bigint" || Number.isInteger(value);
    function intResolve(str, offset, radix, { intAsBigInt }) {
      const sign = str[0];
      if (sign === "-" || sign === "+")
        offset += 1;
      str = str.substring(offset).replace(/_/g, "");
      if (intAsBigInt) {
        switch (radix) {
          case 2:
            str = `0b${str}`;
            break;
          case 8:
            str = `0o${str}`;
            break;
          case 16:
            str = `0x${str}`;
            break;
        }
        const n2 = BigInt(str);
        return sign === "-" ? BigInt(-1) * n2 : n2;
      }
      const n = parseInt(str, radix);
      return sign === "-" ? -1 * n : n;
    }
    function intStringify(node, radix, prefix) {
      const { value } = node;
      if (intIdentify(value)) {
        const str = value.toString(radix);
        return value < 0 ? "-" + prefix + str.substr(1) : prefix + str;
      }
      return stringifyNumber.stringifyNumber(node);
    }
    var intBin = {
      identify: intIdentify,
      default: true,
      tag: "tag:yaml.org,2002:int",
      format: "BIN",
      test: /^[-+]?0b[0-1_]+$/,
      resolve: (str, _onError, opt) => intResolve(str, 2, 2, opt),
      stringify: (node) => intStringify(node, 2, "0b")
    };
    var intOct = {
      identify: intIdentify,
      default: true,
      tag: "tag:yaml.org,2002:int",
      format: "OCT",
      test: /^[-+]?0[0-7_]+$/,
      resolve: (str, _onError, opt) => intResolve(str, 1, 8, opt),
      stringify: (node) => intStringify(node, 8, "0")
    };
    var int = {
      identify: intIdentify,
      default: true,
      tag: "tag:yaml.org,2002:int",
      test: /^[-+]?[0-9][0-9_]*$/,
      resolve: (str, _onError, opt) => intResolve(str, 0, 10, opt),
      stringify: stringifyNumber.stringifyNumber
    };
    var intHex = {
      identify: intIdentify,
      default: true,
      tag: "tag:yaml.org,2002:int",
      format: "HEX",
      test: /^[-+]?0x[0-9a-fA-F_]+$/,
      resolve: (str, _onError, opt) => intResolve(str, 2, 16, opt),
      stringify: (node) => intStringify(node, 16, "0x")
    };
    exports.int = int;
    exports.intBin = intBin;
    exports.intHex = intHex;
    exports.intOct = intOct;
  }
});

// node_modules/yaml/dist/schema/yaml-1.1/set.js
var require_set = __commonJS({
  "node_modules/yaml/dist/schema/yaml-1.1/set.js"(exports) {
    "use strict";
    var identity = require_identity();
    var Pair = require_Pair();
    var YAMLMap = require_YAMLMap();
    var YAMLSet = class _YAMLSet extends YAMLMap.YAMLMap {
      constructor(schema) {
        super(schema);
        this.tag = _YAMLSet.tag;
      }
      add(key) {
        let pair;
        if (identity.isPair(key))
          pair = key;
        else if (key && typeof key === "object" && "key" in key && "value" in key && key.value === null)
          pair = new Pair.Pair(key.key, null);
        else
          pair = new Pair.Pair(key, null);
        const prev = YAMLMap.findPair(this.items, pair.key);
        if (!prev)
          this.items.push(pair);
      }
      /**
       * If `keepPair` is `true`, returns the Pair matching `key`.
       * Otherwise, returns the value of that Pair's key.
       */
      get(key, keepPair) {
        const pair = YAMLMap.findPair(this.items, key);
        return !keepPair && identity.isPair(pair) ? identity.isScalar(pair.key) ? pair.key.value : pair.key : pair;
      }
      set(key, value) {
        if (typeof value !== "boolean")
          throw new Error(`Expected boolean value for set(key, value) in a YAML set, not ${typeof value}`);
        const prev = YAMLMap.findPair(this.items, key);
        if (prev && !value) {
          this.items.splice(this.items.indexOf(prev), 1);
        } else if (!prev && value) {
          this.items.push(new Pair.Pair(key));
        }
      }
      toJSON(_, ctx) {
        return super.toJSON(_, ctx, Set);
      }
      toString(ctx, onComment, onChompKeep) {
        if (!ctx)
          return JSON.stringify(this);
        if (this.hasAllNullValues(true))
          return super.toString(Object.assign({}, ctx, { allNullValues: true }), onComment, onChompKeep);
        else
          throw new Error("Set items must all have null values");
      }
      static from(schema, iterable, ctx) {
        const { replacer } = ctx;
        const set2 = new this(schema);
        if (iterable && Symbol.iterator in Object(iterable))
          for (let value of iterable) {
            if (typeof replacer === "function")
              value = replacer.call(iterable, value, value);
            set2.items.push(Pair.createPair(value, null, ctx));
          }
        return set2;
      }
    };
    YAMLSet.tag = "tag:yaml.org,2002:set";
    var set = {
      collection: "map",
      identify: (value) => value instanceof Set,
      nodeClass: YAMLSet,
      default: false,
      tag: "tag:yaml.org,2002:set",
      createNode: (schema, iterable, ctx) => YAMLSet.from(schema, iterable, ctx),
      resolve(map, onError) {
        if (identity.isMap(map)) {
          if (map.hasAllNullValues(true))
            return Object.assign(new YAMLSet(), map);
          else
            onError("Set items must all have null values");
        } else
          onError("Expected a mapping for this tag");
        return map;
      }
    };
    exports.YAMLSet = YAMLSet;
    exports.set = set;
  }
});

// node_modules/yaml/dist/schema/yaml-1.1/timestamp.js
var require_timestamp = __commonJS({
  "node_modules/yaml/dist/schema/yaml-1.1/timestamp.js"(exports) {
    "use strict";
    var stringifyNumber = require_stringifyNumber();
    function parseSexagesimal(str, asBigInt) {
      const sign = str[0];
      const parts = sign === "-" || sign === "+" ? str.substring(1) : str;
      const num = (n) => asBigInt ? BigInt(n) : Number(n);
      const res = parts.replace(/_/g, "").split(":").reduce((res2, p) => res2 * num(60) + num(p), num(0));
      return sign === "-" ? num(-1) * res : res;
    }
    function stringifySexagesimal(node) {
      let { value } = node;
      let num = (n) => n;
      if (typeof value === "bigint")
        num = (n) => BigInt(n);
      else if (isNaN(value) || !isFinite(value))
        return stringifyNumber.stringifyNumber(node);
      let sign = "";
      if (value < 0) {
        sign = "-";
        value *= num(-1);
      }
      const _60 = num(60);
      const parts = [value % _60];
      if (value < 60) {
        parts.unshift(0);
      } else {
        value = (value - parts[0]) / _60;
        parts.unshift(value % _60);
        if (value >= 60) {
          value = (value - parts[0]) / _60;
          parts.unshift(value);
        }
      }
      return sign + parts.map((n) => String(n).padStart(2, "0")).join(":").replace(/000000\d*$/, "");
    }
    var intTime = {
      identify: (value) => typeof value === "bigint" || Number.isInteger(value),
      default: true,
      tag: "tag:yaml.org,2002:int",
      format: "TIME",
      test: /^[-+]?[0-9][0-9_]*(?::[0-5]?[0-9])+$/,
      resolve: (str, _onError, { intAsBigInt }) => parseSexagesimal(str, intAsBigInt),
      stringify: stringifySexagesimal
    };
    var floatTime = {
      identify: (value) => typeof value === "number",
      default: true,
      tag: "tag:yaml.org,2002:float",
      format: "TIME",
      test: /^[-+]?[0-9][0-9_]*(?::[0-5]?[0-9])+\.[0-9_]*$/,
      resolve: (str) => parseSexagesimal(str, false),
      stringify: stringifySexagesimal
    };
    var timestamp = {
      identify: (value) => value instanceof Date,
      default: true,
      tag: "tag:yaml.org,2002:timestamp",
      // If the time zone is omitted, the timestamp is assumed to be specified in UTC. The time part
      // may be omitted altogether, resulting in a date format. In such a case, the time part is
      // assumed to be 00:00:00Z (start of day, UTC).
      test: RegExp("^([0-9]{4})-([0-9]{1,2})-([0-9]{1,2})(?:(?:t|T|[ \\t]+)([0-9]{1,2}):([0-9]{1,2}):([0-9]{1,2}(\\.[0-9]+)?)(?:[ \\t]*(Z|[-+][012]?[0-9](?::[0-9]{2})?))?)?$"),
      resolve(str) {
        const match = str.match(timestamp.test);
        if (!match)
          throw new Error("!!timestamp expects a date, starting with yyyy-mm-dd");
        const [, year, month, day, hour, minute, second] = match.map(Number);
        const millisec = match[7] ? Number((match[7] + "00").substr(1, 3)) : 0;
        let date = Date.UTC(year, month - 1, day, hour || 0, minute || 0, second || 0, millisec);
        const tz = match[8];
        if (tz && tz !== "Z") {
          let d = parseSexagesimal(tz, false);
          if (Math.abs(d) < 30)
            d *= 60;
          date -= 6e4 * d;
        }
        return new Date(date);
      },
      stringify: ({ value }) => value?.toISOString().replace(/(T00:00:00)?\.000Z$/, "") ?? ""
    };
    exports.floatTime = floatTime;
    exports.intTime = intTime;
    exports.timestamp = timestamp;
  }
});

// node_modules/yaml/dist/schema/yaml-1.1/schema.js
var require_schema3 = __commonJS({
  "node_modules/yaml/dist/schema/yaml-1.1/schema.js"(exports) {
    "use strict";
    var map = require_map();
    var _null = require_null();
    var seq = require_seq();
    var string = require_string();
    var binary = require_binary();
    var bool = require_bool2();
    var float = require_float2();
    var int = require_int2();
    var merge = require_merge();
    var omap = require_omap();
    var pairs = require_pairs();
    var set = require_set();
    var timestamp = require_timestamp();
    var schema = [
      map.map,
      seq.seq,
      string.string,
      _null.nullTag,
      bool.trueTag,
      bool.falseTag,
      int.intBin,
      int.intOct,
      int.int,
      int.intHex,
      float.floatNaN,
      float.floatExp,
      float.float,
      binary.binary,
      merge.merge,
      omap.omap,
      pairs.pairs,
      set.set,
      timestamp.intTime,
      timestamp.floatTime,
      timestamp.timestamp
    ];
    exports.schema = schema;
  }
});

// node_modules/yaml/dist/schema/tags.js
var require_tags = __commonJS({
  "node_modules/yaml/dist/schema/tags.js"(exports) {
    "use strict";
    var map = require_map();
    var _null = require_null();
    var seq = require_seq();
    var string = require_string();
    var bool = require_bool();
    var float = require_float();
    var int = require_int();
    var schema = require_schema();
    var schema$1 = require_schema2();
    var binary = require_binary();
    var merge = require_merge();
    var omap = require_omap();
    var pairs = require_pairs();
    var schema$2 = require_schema3();
    var set = require_set();
    var timestamp = require_timestamp();
    var schemas = /* @__PURE__ */ new Map([
      ["core", schema.schema],
      ["failsafe", [map.map, seq.seq, string.string]],
      ["json", schema$1.schema],
      ["yaml11", schema$2.schema],
      ["yaml-1.1", schema$2.schema]
    ]);
    var tagsByName = {
      binary: binary.binary,
      bool: bool.boolTag,
      float: float.float,
      floatExp: float.floatExp,
      floatNaN: float.floatNaN,
      floatTime: timestamp.floatTime,
      int: int.int,
      intHex: int.intHex,
      intOct: int.intOct,
      intTime: timestamp.intTime,
      map: map.map,
      merge: merge.merge,
      null: _null.nullTag,
      omap: omap.omap,
      pairs: pairs.pairs,
      seq: seq.seq,
      set: set.set,
      timestamp: timestamp.timestamp
    };
    var coreKnownTags = {
      "tag:yaml.org,2002:binary": binary.binary,
      "tag:yaml.org,2002:merge": merge.merge,
      "tag:yaml.org,2002:omap": omap.omap,
      "tag:yaml.org,2002:pairs": pairs.pairs,
      "tag:yaml.org,2002:set": set.set,
      "tag:yaml.org,2002:timestamp": timestamp.timestamp
    };
    function getTags(customTags, schemaName, addMergeTag) {
      const schemaTags = schemas.get(schemaName);
      if (schemaTags && !customTags) {
        return addMergeTag && !schemaTags.includes(merge.merge) ? schemaTags.concat(merge.merge) : schemaTags.slice();
      }
      let tags = schemaTags;
      if (!tags) {
        if (Array.isArray(customTags))
          tags = [];
        else {
          const keys = Array.from(schemas.keys()).filter((key) => key !== "yaml11").map((key) => JSON.stringify(key)).join(", ");
          throw new Error(`Unknown schema "${schemaName}"; use one of ${keys} or define customTags array`);
        }
      }
      if (Array.isArray(customTags)) {
        for (const tag of customTags)
          tags = tags.concat(tag);
      } else if (typeof customTags === "function") {
        tags = customTags(tags.slice());
      }
      if (addMergeTag)
        tags = tags.concat(merge.merge);
      return tags.reduce((tags2, tag) => {
        const tagObj = typeof tag === "string" ? tagsByName[tag] : tag;
        if (!tagObj) {
          const tagName = JSON.stringify(tag);
          const keys = Object.keys(tagsByName).map((key) => JSON.stringify(key)).join(", ");
          throw new Error(`Unknown custom tag ${tagName}; use one of ${keys}`);
        }
        if (!tags2.includes(tagObj))
          tags2.push(tagObj);
        return tags2;
      }, []);
    }
    exports.coreKnownTags = coreKnownTags;
    exports.getTags = getTags;
  }
});

// node_modules/yaml/dist/schema/Schema.js
var require_Schema = __commonJS({
  "node_modules/yaml/dist/schema/Schema.js"(exports) {
    "use strict";
    var identity = require_identity();
    var map = require_map();
    var seq = require_seq();
    var string = require_string();
    var tags = require_tags();
    var sortMapEntriesByKey = (a, b) => a.key < b.key ? -1 : a.key > b.key ? 1 : 0;
    var Schema = class _Schema {
      constructor({ compat, customTags, merge, resolveKnownTags, schema, sortMapEntries, toStringDefaults }) {
        this.compat = Array.isArray(compat) ? tags.getTags(compat, "compat") : compat ? tags.getTags(null, compat) : null;
        this.name = typeof schema === "string" && schema || "core";
        this.knownTags = resolveKnownTags ? tags.coreKnownTags : {};
        this.tags = tags.getTags(customTags, this.name, merge);
        this.toStringOptions = toStringDefaults ?? null;
        Object.defineProperty(this, identity.MAP, { value: map.map });
        Object.defineProperty(this, identity.SCALAR, { value: string.string });
        Object.defineProperty(this, identity.SEQ, { value: seq.seq });
        this.sortMapEntries = typeof sortMapEntries === "function" ? sortMapEntries : sortMapEntries === true ? sortMapEntriesByKey : null;
      }
      clone() {
        const copy = Object.create(_Schema.prototype, Object.getOwnPropertyDescriptors(this));
        copy.tags = this.tags.slice();
        return copy;
      }
    };
    exports.Schema = Schema;
  }
});

// node_modules/yaml/dist/stringify/stringifyDocument.js
var require_stringifyDocument = __commonJS({
  "node_modules/yaml/dist/stringify/stringifyDocument.js"(exports) {
    "use strict";
    var identity = require_identity();
    var stringify = require_stringify();
    var stringifyComment = require_stringifyComment();
    function stringifyDocument(doc, options) {
      const lines = [];
      let hasDirectives = options.directives === true;
      if (options.directives !== false && doc.directives) {
        const dir = doc.directives.toString(doc);
        if (dir) {
          lines.push(dir);
          hasDirectives = true;
        } else if (doc.directives.docStart)
          hasDirectives = true;
      }
      if (hasDirectives)
        lines.push("---");
      const ctx = stringify.createStringifyContext(doc, options);
      const { commentString } = ctx.options;
      if (doc.commentBefore) {
        if (lines.length !== 1)
          lines.unshift("");
        const cs = commentString(doc.commentBefore);
        lines.unshift(stringifyComment.indentComment(cs, ""));
      }
      let chompKeep = false;
      let contentComment = null;
      if (doc.contents) {
        if (identity.isNode(doc.contents)) {
          if (doc.contents.spaceBefore && hasDirectives)
            lines.push("");
          if (doc.contents.commentBefore) {
            const cs = commentString(doc.contents.commentBefore);
            lines.push(stringifyComment.indentComment(cs, ""));
          }
          ctx.forceBlockIndent = !!doc.comment;
          contentComment = doc.contents.comment;
        }
        const onChompKeep = contentComment ? void 0 : () => chompKeep = true;
        let body = stringify.stringify(doc.contents, ctx, () => contentComment = null, onChompKeep);
        if (contentComment)
          body += stringifyComment.lineComment(body, "", commentString(contentComment));
        if ((body[0] === "|" || body[0] === ">") && lines[lines.length - 1] === "---") {
          lines[lines.length - 1] = `--- ${body}`;
        } else
          lines.push(body);
      } else {
        lines.push(stringify.stringify(doc.contents, ctx));
      }
      if (doc.directives?.docEnd) {
        if (doc.comment) {
          const cs = commentString(doc.comment);
          if (cs.includes("\n")) {
            lines.push("...");
            lines.push(stringifyComment.indentComment(cs, ""));
          } else {
            lines.push(`... ${cs}`);
          }
        } else {
          lines.push("...");
        }
      } else {
        let dc = doc.comment;
        if (dc && chompKeep)
          dc = dc.replace(/^\n+/, "");
        if (dc) {
          if ((!chompKeep || contentComment) && lines[lines.length - 1] !== "")
            lines.push("");
          lines.push(stringifyComment.indentComment(commentString(dc), ""));
        }
      }
      return lines.join("\n") + "\n";
    }
    exports.stringifyDocument = stringifyDocument;
  }
});

// node_modules/yaml/dist/doc/Document.js
var require_Document = __commonJS({
  "node_modules/yaml/dist/doc/Document.js"(exports) {
    "use strict";
    var Alias = require_Alias();
    var Collection = require_Collection();
    var identity = require_identity();
    var Pair = require_Pair();
    var toJS = require_toJS();
    var Schema = require_Schema();
    var stringifyDocument = require_stringifyDocument();
    var anchors = require_anchors();
    var applyReviver = require_applyReviver();
    var createNode = require_createNode();
    var directives = require_directives();
    var Document = class _Document {
      constructor(value, replacer, options) {
        this.commentBefore = null;
        this.comment = null;
        this.errors = [];
        this.warnings = [];
        Object.defineProperty(this, identity.NODE_TYPE, { value: identity.DOC });
        let _replacer = null;
        if (typeof replacer === "function" || Array.isArray(replacer)) {
          _replacer = replacer;
        } else if (options === void 0 && replacer) {
          options = replacer;
          replacer = void 0;
        }
        const opt = Object.assign({
          intAsBigInt: false,
          keepSourceTokens: false,
          logLevel: "warn",
          prettyErrors: true,
          strict: true,
          stringKeys: false,
          uniqueKeys: true,
          version: "1.2"
        }, options);
        this.options = opt;
        let { version } = opt;
        if (options?._directives) {
          this.directives = options._directives.atDocument();
          if (this.directives.yaml.explicit)
            version = this.directives.yaml.version;
        } else
          this.directives = new directives.Directives({ version });
        this.setSchema(version, options);
        this.contents = value === void 0 ? null : this.createNode(value, _replacer, options);
      }
      /**
       * Create a deep copy of this Document and its contents.
       *
       * Custom Node values that inherit from `Object` still refer to their original instances.
       */
      clone() {
        const copy = Object.create(_Document.prototype, {
          [identity.NODE_TYPE]: { value: identity.DOC }
        });
        copy.commentBefore = this.commentBefore;
        copy.comment = this.comment;
        copy.errors = this.errors.slice();
        copy.warnings = this.warnings.slice();
        copy.options = Object.assign({}, this.options);
        if (this.directives)
          copy.directives = this.directives.clone();
        copy.schema = this.schema.clone();
        copy.contents = identity.isNode(this.contents) ? this.contents.clone(copy.schema) : this.contents;
        if (this.range)
          copy.range = this.range.slice();
        return copy;
      }
      /** Adds a value to the document. */
      add(value) {
        if (assertCollection(this.contents))
          this.contents.add(value);
      }
      /** Adds a value to the document. */
      addIn(path, value) {
        if (assertCollection(this.contents))
          this.contents.addIn(path, value);
      }
      /**
       * Create a new `Alias` node, ensuring that the target `node` has the required anchor.
       *
       * If `node` already has an anchor, `name` is ignored.
       * Otherwise, the `node.anchor` value will be set to `name`,
       * or if an anchor with that name is already present in the document,
       * `name` will be used as a prefix for a new unique anchor.
       * If `name` is undefined, the generated anchor will use 'a' as a prefix.
       */
      createAlias(node, name) {
        if (!node.anchor) {
          const prev = anchors.anchorNames(this);
          node.anchor = // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
          !name || prev.has(name) ? anchors.findNewAnchor(name || "a", prev) : name;
        }
        return new Alias.Alias(node.anchor);
      }
      createNode(value, replacer, options) {
        let _replacer = void 0;
        if (typeof replacer === "function") {
          value = replacer.call({ "": value }, "", value);
          _replacer = replacer;
        } else if (Array.isArray(replacer)) {
          const keyToStr = (v) => typeof v === "number" || v instanceof String || v instanceof Number;
          const asStr = replacer.filter(keyToStr).map(String);
          if (asStr.length > 0)
            replacer = replacer.concat(asStr);
          _replacer = replacer;
        } else if (options === void 0 && replacer) {
          options = replacer;
          replacer = void 0;
        }
        const { aliasDuplicateObjects, anchorPrefix, flow, keepUndefined, onTagObj, tag } = options ?? {};
        const { onAnchor, setAnchors, sourceObjects } = anchors.createNodeAnchors(
          this,
          // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
          anchorPrefix || "a"
        );
        const ctx = {
          aliasDuplicateObjects: aliasDuplicateObjects ?? true,
          keepUndefined: keepUndefined ?? false,
          onAnchor,
          onTagObj,
          replacer: _replacer,
          schema: this.schema,
          sourceObjects
        };
        const node = createNode.createNode(value, tag, ctx);
        if (flow && identity.isCollection(node))
          node.flow = true;
        setAnchors();
        return node;
      }
      /**
       * Convert a key and a value into a `Pair` using the current schema,
       * recursively wrapping all values as `Scalar` or `Collection` nodes.
       */
      createPair(key, value, options = {}) {
        const k = this.createNode(key, null, options);
        const v = this.createNode(value, null, options);
        return new Pair.Pair(k, v);
      }
      /**
       * Removes a value from the document.
       * @returns `true` if the item was found and removed.
       */
      delete(key) {
        return assertCollection(this.contents) ? this.contents.delete(key) : false;
      }
      /**
       * Removes a value from the document.
       * @returns `true` if the item was found and removed.
       */
      deleteIn(path) {
        if (Collection.isEmptyPath(path)) {
          if (this.contents == null)
            return false;
          this.contents = null;
          return true;
        }
        return assertCollection(this.contents) ? this.contents.deleteIn(path) : false;
      }
      /**
       * Returns item at `key`, or `undefined` if not found. By default unwraps
       * scalar values from their surrounding node; to disable set `keepScalar` to
       * `true` (collections are always returned intact).
       */
      get(key, keepScalar) {
        return identity.isCollection(this.contents) ? this.contents.get(key, keepScalar) : void 0;
      }
      /**
       * Returns item at `path`, or `undefined` if not found. By default unwraps
       * scalar values from their surrounding node; to disable set `keepScalar` to
       * `true` (collections are always returned intact).
       */
      getIn(path, keepScalar) {
        if (Collection.isEmptyPath(path))
          return !keepScalar && identity.isScalar(this.contents) ? this.contents.value : this.contents;
        return identity.isCollection(this.contents) ? this.contents.getIn(path, keepScalar) : void 0;
      }
      /**
       * Checks if the document includes a value with the key `key`.
       */
      has(key) {
        return identity.isCollection(this.contents) ? this.contents.has(key) : false;
      }
      /**
       * Checks if the document includes a value at `path`.
       */
      hasIn(path) {
        if (Collection.isEmptyPath(path))
          return this.contents !== void 0;
        return identity.isCollection(this.contents) ? this.contents.hasIn(path) : false;
      }
      /**
       * Sets a value in this document. For `!!set`, `value` needs to be a
       * boolean to add/remove the item from the set.
       */
      set(key, value) {
        if (this.contents == null) {
          this.contents = Collection.collectionFromPath(this.schema, [key], value);
        } else if (assertCollection(this.contents)) {
          this.contents.set(key, value);
        }
      }
      /**
       * Sets a value in this document. For `!!set`, `value` needs to be a
       * boolean to add/remove the item from the set.
       */
      setIn(path, value) {
        if (Collection.isEmptyPath(path)) {
          this.contents = value;
        } else if (this.contents == null) {
          this.contents = Collection.collectionFromPath(this.schema, Array.from(path), value);
        } else if (assertCollection(this.contents)) {
          this.contents.setIn(path, value);
        }
      }
      /**
       * Change the YAML version and schema used by the document.
       * A `null` version disables support for directives, explicit tags, anchors, and aliases.
       * It also requires the `schema` option to be given as a `Schema` instance value.
       *
       * Overrides all previously set schema options.
       */
      setSchema(version, options = {}) {
        if (typeof version === "number")
          version = String(version);
        let opt;
        switch (version) {
          case "1.1":
            if (this.directives)
              this.directives.yaml.version = "1.1";
            else
              this.directives = new directives.Directives({ version: "1.1" });
            opt = { resolveKnownTags: false, schema: "yaml-1.1" };
            break;
          case "1.2":
          case "next":
            if (this.directives)
              this.directives.yaml.version = version;
            else
              this.directives = new directives.Directives({ version });
            opt = { resolveKnownTags: true, schema: "core" };
            break;
          case null:
            if (this.directives)
              delete this.directives;
            opt = null;
            break;
          default: {
            const sv = JSON.stringify(version);
            throw new Error(`Expected '1.1', '1.2' or null as first argument, but found: ${sv}`);
          }
        }
        if (options.schema instanceof Object)
          this.schema = options.schema;
        else if (opt)
          this.schema = new Schema.Schema(Object.assign(opt, options));
        else
          throw new Error(`With a null YAML version, the { schema: Schema } option is required`);
      }
      // json & jsonArg are only used from toJSON()
      toJS({ json, jsonArg, mapAsMap, maxAliasCount, onAnchor, reviver } = {}) {
        const ctx = {
          anchors: /* @__PURE__ */ new Map(),
          doc: this,
          keep: !json,
          mapAsMap: mapAsMap === true,
          mapKeyWarned: false,
          maxAliasCount: typeof maxAliasCount === "number" ? maxAliasCount : 100
        };
        const res = toJS.toJS(this.contents, jsonArg ?? "", ctx);
        if (typeof onAnchor === "function")
          for (const { count, res: res2 } of ctx.anchors.values())
            onAnchor(res2, count);
        return typeof reviver === "function" ? applyReviver.applyReviver(reviver, { "": res }, "", res) : res;
      }
      /**
       * A JSON representation of the document `contents`.
       *
       * @param jsonArg Used by `JSON.stringify` to indicate the array index or
       *   property name.
       */
      toJSON(jsonArg, onAnchor) {
        return this.toJS({ json: true, jsonArg, mapAsMap: false, onAnchor });
      }
      /** A YAML representation of the document. */
      toString(options = {}) {
        if (this.errors.length > 0)
          throw new Error("Document with errors cannot be stringified");
        if ("indent" in options && (!Number.isInteger(options.indent) || Number(options.indent) <= 0)) {
          const s = JSON.stringify(options.indent);
          throw new Error(`"indent" option must be a positive integer, not ${s}`);
        }
        return stringifyDocument.stringifyDocument(this, options);
      }
    };
    function assertCollection(contents) {
      if (identity.isCollection(contents))
        return true;
      throw new Error("Expected a YAML collection as document contents");
    }
    exports.Document = Document;
  }
});

// node_modules/yaml/dist/errors.js
var require_errors = __commonJS({
  "node_modules/yaml/dist/errors.js"(exports) {
    "use strict";
    var YAMLError = class extends Error {
      constructor(name, pos, code, message) {
        super();
        this.name = name;
        this.code = code;
        this.message = message;
        this.pos = pos;
      }
    };
    var YAMLParseError = class extends YAMLError {
      constructor(pos, code, message) {
        super("YAMLParseError", pos, code, message);
      }
    };
    var YAMLWarning = class extends YAMLError {
      constructor(pos, code, message) {
        super("YAMLWarning", pos, code, message);
      }
    };
    var prettifyError = (src, lc) => (error) => {
      if (error.pos[0] === -1)
        return;
      error.linePos = error.pos.map((pos) => lc.linePos(pos));
      const { line, col } = error.linePos[0];
      error.message += ` at line ${line}, column ${col}`;
      let ci = col - 1;
      let lineStr = src.substring(lc.lineStarts[line - 1], lc.lineStarts[line]).replace(/[\n\r]+$/, "");
      if (ci >= 60 && lineStr.length > 80) {
        const trimStart = Math.min(ci - 39, lineStr.length - 79);
        lineStr = "\u2026" + lineStr.substring(trimStart);
        ci -= trimStart - 1;
      }
      if (lineStr.length > 80)
        lineStr = lineStr.substring(0, 79) + "\u2026";
      if (line > 1 && /^ *$/.test(lineStr.substring(0, ci))) {
        let prev = src.substring(lc.lineStarts[line - 2], lc.lineStarts[line - 1]);
        if (prev.length > 80)
          prev = prev.substring(0, 79) + "\u2026\n";
        lineStr = prev + lineStr;
      }
      if (/[^ ]/.test(lineStr)) {
        let count = 1;
        const end = error.linePos[1];
        if (end?.line === line && end.col > col) {
          count = Math.max(1, Math.min(end.col - col, 80 - ci));
        }
        const pointer = " ".repeat(ci) + "^".repeat(count);
        error.message += `:

${lineStr}
${pointer}
`;
      }
    };
    exports.YAMLError = YAMLError;
    exports.YAMLParseError = YAMLParseError;
    exports.YAMLWarning = YAMLWarning;
    exports.prettifyError = prettifyError;
  }
});

// node_modules/yaml/dist/compose/resolve-props.js
var require_resolve_props = __commonJS({
  "node_modules/yaml/dist/compose/resolve-props.js"(exports) {
    "use strict";
    function resolveProps(tokens, { flow, indicator, next, offset, onError, parentIndent, startOnNewline }) {
      let spaceBefore = false;
      let atNewline = startOnNewline;
      let hasSpace = startOnNewline;
      let comment = "";
      let commentSep = "";
      let hasNewline = false;
      let reqSpace = false;
      let tab = null;
      let anchor = null;
      let tag = null;
      let newlineAfterProp = null;
      let comma = null;
      let found = null;
      let start = null;
      for (const token of tokens) {
        if (reqSpace) {
          if (token.type !== "space" && token.type !== "newline" && token.type !== "comma")
            onError(token.offset, "MISSING_CHAR", "Tags and anchors must be separated from the next token by white space");
          reqSpace = false;
        }
        if (tab) {
          if (atNewline && token.type !== "comment" && token.type !== "newline") {
            onError(tab, "TAB_AS_INDENT", "Tabs are not allowed as indentation");
          }
          tab = null;
        }
        switch (token.type) {
          case "space":
            if (!flow && (indicator !== "doc-start" || next?.type !== "flow-collection") && token.source.includes("	")) {
              tab = token;
            }
            hasSpace = true;
            break;
          case "comment": {
            if (!hasSpace)
              onError(token, "MISSING_CHAR", "Comments must be separated from other tokens by white space characters");
            const cb = token.source.substring(1) || " ";
            if (!comment)
              comment = cb;
            else
              comment += commentSep + cb;
            commentSep = "";
            atNewline = false;
            break;
          }
          case "newline":
            if (atNewline) {
              if (comment)
                comment += token.source;
              else if (!found || indicator !== "seq-item-ind")
                spaceBefore = true;
            } else
              commentSep += token.source;
            atNewline = true;
            hasNewline = true;
            if (anchor || tag)
              newlineAfterProp = token;
            hasSpace = true;
            break;
          case "anchor":
            if (anchor)
              onError(token, "MULTIPLE_ANCHORS", "A node can have at most one anchor");
            if (token.source.endsWith(":"))
              onError(token.offset + token.source.length - 1, "BAD_ALIAS", "Anchor ending in : is ambiguous", true);
            anchor = token;
            start ?? (start = token.offset);
            atNewline = false;
            hasSpace = false;
            reqSpace = true;
            break;
          case "tag": {
            if (tag)
              onError(token, "MULTIPLE_TAGS", "A node can have at most one tag");
            tag = token;
            start ?? (start = token.offset);
            atNewline = false;
            hasSpace = false;
            reqSpace = true;
            break;
          }
          case indicator:
            if (anchor || tag)
              onError(token, "BAD_PROP_ORDER", `Anchors and tags must be after the ${token.source} indicator`);
            if (found)
              onError(token, "UNEXPECTED_TOKEN", `Unexpected ${token.source} in ${flow ?? "collection"}`);
            found = token;
            atNewline = indicator === "seq-item-ind" || indicator === "explicit-key-ind";
            hasSpace = false;
            break;
          case "comma":
            if (flow) {
              if (comma)
                onError(token, "UNEXPECTED_TOKEN", `Unexpected , in ${flow}`);
              comma = token;
              atNewline = false;
              hasSpace = false;
              break;
            }
          // else fallthrough
          default:
            onError(token, "UNEXPECTED_TOKEN", `Unexpected ${token.type} token`);
            atNewline = false;
            hasSpace = false;
        }
      }
      const last = tokens[tokens.length - 1];
      const end = last ? last.offset + last.source.length : offset;
      if (reqSpace && next && next.type !== "space" && next.type !== "newline" && next.type !== "comma" && (next.type !== "scalar" || next.source !== "")) {
        onError(next.offset, "MISSING_CHAR", "Tags and anchors must be separated from the next token by white space");
      }
      if (tab && (atNewline && tab.indent <= parentIndent || next?.type === "block-map" || next?.type === "block-seq"))
        onError(tab, "TAB_AS_INDENT", "Tabs are not allowed as indentation");
      return {
        comma,
        found,
        spaceBefore,
        comment,
        hasNewline,
        anchor,
        tag,
        newlineAfterProp,
        end,
        start: start ?? end
      };
    }
    exports.resolveProps = resolveProps;
  }
});

// node_modules/yaml/dist/compose/util-contains-newline.js
var require_util_contains_newline = __commonJS({
  "node_modules/yaml/dist/compose/util-contains-newline.js"(exports) {
    "use strict";
    function containsNewline(key) {
      if (!key)
        return null;
      switch (key.type) {
        case "alias":
        case "scalar":
        case "double-quoted-scalar":
        case "single-quoted-scalar":
          if (key.source.includes("\n"))
            return true;
          if (key.end) {
            for (const st of key.end)
              if (st.type === "newline")
                return true;
          }
          return false;
        case "flow-collection":
          for (const it of key.items) {
            for (const st of it.start)
              if (st.type === "newline")
                return true;
            if (it.sep) {
              for (const st of it.sep)
                if (st.type === "newline")
                  return true;
            }
            if (containsNewline(it.key) || containsNewline(it.value))
              return true;
          }
          return false;
        default:
          return true;
      }
    }
    exports.containsNewline = containsNewline;
  }
});

// node_modules/yaml/dist/compose/util-flow-indent-check.js
var require_util_flow_indent_check = __commonJS({
  "node_modules/yaml/dist/compose/util-flow-indent-check.js"(exports) {
    "use strict";
    var utilContainsNewline = require_util_contains_newline();
    function flowIndentCheck(indent, fc, onError) {
      if (fc?.type === "flow-collection") {
        const end = fc.end[0];
        if (end.indent === indent && (end.source === "]" || end.source === "}") && utilContainsNewline.containsNewline(fc)) {
          const msg = "Flow end indicator should be more indented than parent";
          onError(end, "BAD_INDENT", msg, true);
        }
      }
    }
    exports.flowIndentCheck = flowIndentCheck;
  }
});

// node_modules/yaml/dist/compose/util-map-includes.js
var require_util_map_includes = __commonJS({
  "node_modules/yaml/dist/compose/util-map-includes.js"(exports) {
    "use strict";
    var identity = require_identity();
    function mapIncludes(ctx, items, search) {
      const { uniqueKeys } = ctx.options;
      if (uniqueKeys === false)
        return false;
      const isEqual = typeof uniqueKeys === "function" ? uniqueKeys : (a, b) => a === b || identity.isScalar(a) && identity.isScalar(b) && a.value === b.value;
      return items.some((pair) => isEqual(pair.key, search));
    }
    exports.mapIncludes = mapIncludes;
  }
});

// node_modules/yaml/dist/compose/resolve-block-map.js
var require_resolve_block_map = __commonJS({
  "node_modules/yaml/dist/compose/resolve-block-map.js"(exports) {
    "use strict";
    var Pair = require_Pair();
    var YAMLMap = require_YAMLMap();
    var resolveProps = require_resolve_props();
    var utilContainsNewline = require_util_contains_newline();
    var utilFlowIndentCheck = require_util_flow_indent_check();
    var utilMapIncludes = require_util_map_includes();
    var startColMsg = "All mapping items must start at the same column";
    function resolveBlockMap({ composeNode, composeEmptyNode }, ctx, bm, onError, tag) {
      const NodeClass = tag?.nodeClass ?? YAMLMap.YAMLMap;
      const map = new NodeClass(ctx.schema);
      if (ctx.atRoot)
        ctx.atRoot = false;
      let offset = bm.offset;
      let commentEnd = null;
      for (const collItem of bm.items) {
        const { start, key, sep: sep2, value } = collItem;
        const keyProps = resolveProps.resolveProps(start, {
          indicator: "explicit-key-ind",
          next: key ?? sep2?.[0],
          offset,
          onError,
          parentIndent: bm.indent,
          startOnNewline: true
        });
        const implicitKey = !keyProps.found;
        if (implicitKey) {
          if (key) {
            if (key.type === "block-seq")
              onError(offset, "BLOCK_AS_IMPLICIT_KEY", "A block sequence may not be used as an implicit map key");
            else if ("indent" in key && key.indent !== bm.indent)
              onError(offset, "BAD_INDENT", startColMsg);
          }
          if (!keyProps.anchor && !keyProps.tag && !sep2) {
            commentEnd = keyProps.end;
            if (keyProps.comment) {
              if (map.comment)
                map.comment += "\n" + keyProps.comment;
              else
                map.comment = keyProps.comment;
            }
            continue;
          }
          if (keyProps.newlineAfterProp || utilContainsNewline.containsNewline(key)) {
            onError(key ?? start[start.length - 1], "MULTILINE_IMPLICIT_KEY", "Implicit keys need to be on a single line");
          }
        } else if (keyProps.found?.indent !== bm.indent) {
          onError(offset, "BAD_INDENT", startColMsg);
        }
        ctx.atKey = true;
        const keyStart = keyProps.end;
        const keyNode = key ? composeNode(ctx, key, keyProps, onError) : composeEmptyNode(ctx, keyStart, start, null, keyProps, onError);
        if (ctx.schema.compat)
          utilFlowIndentCheck.flowIndentCheck(bm.indent, key, onError);
        ctx.atKey = false;
        if (utilMapIncludes.mapIncludes(ctx, map.items, keyNode))
          onError(keyStart, "DUPLICATE_KEY", "Map keys must be unique");
        const valueProps = resolveProps.resolveProps(sep2 ?? [], {
          indicator: "map-value-ind",
          next: value,
          offset: keyNode.range[2],
          onError,
          parentIndent: bm.indent,
          startOnNewline: !key || key.type === "block-scalar"
        });
        offset = valueProps.end;
        if (valueProps.found) {
          if (implicitKey) {
            if (value?.type === "block-map" && !valueProps.hasNewline)
              onError(offset, "BLOCK_AS_IMPLICIT_KEY", "Nested mappings are not allowed in compact mappings");
            if (ctx.options.strict && keyProps.start < valueProps.found.offset - 1024)
              onError(keyNode.range, "KEY_OVER_1024_CHARS", "The : indicator must be at most 1024 chars after the start of an implicit block mapping key");
          }
          const valueNode = value ? composeNode(ctx, value, valueProps, onError) : composeEmptyNode(ctx, offset, sep2, null, valueProps, onError);
          if (ctx.schema.compat)
            utilFlowIndentCheck.flowIndentCheck(bm.indent, value, onError);
          offset = valueNode.range[2];
          const pair = new Pair.Pair(keyNode, valueNode);
          if (ctx.options.keepSourceTokens)
            pair.srcToken = collItem;
          map.items.push(pair);
        } else {
          if (implicitKey)
            onError(keyNode.range, "MISSING_CHAR", "Implicit map keys need to be followed by map values");
          if (valueProps.comment) {
            if (keyNode.comment)
              keyNode.comment += "\n" + valueProps.comment;
            else
              keyNode.comment = valueProps.comment;
          }
          const pair = new Pair.Pair(keyNode);
          if (ctx.options.keepSourceTokens)
            pair.srcToken = collItem;
          map.items.push(pair);
        }
      }
      if (commentEnd && commentEnd < offset)
        onError(commentEnd, "IMPOSSIBLE", "Map comment with trailing content");
      map.range = [bm.offset, offset, commentEnd ?? offset];
      return map;
    }
    exports.resolveBlockMap = resolveBlockMap;
  }
});

// node_modules/yaml/dist/compose/resolve-block-seq.js
var require_resolve_block_seq = __commonJS({
  "node_modules/yaml/dist/compose/resolve-block-seq.js"(exports) {
    "use strict";
    var YAMLSeq = require_YAMLSeq();
    var resolveProps = require_resolve_props();
    var utilFlowIndentCheck = require_util_flow_indent_check();
    function resolveBlockSeq({ composeNode, composeEmptyNode }, ctx, bs, onError, tag) {
      const NodeClass = tag?.nodeClass ?? YAMLSeq.YAMLSeq;
      const seq = new NodeClass(ctx.schema);
      if (ctx.atRoot)
        ctx.atRoot = false;
      if (ctx.atKey)
        ctx.atKey = false;
      let offset = bs.offset;
      let commentEnd = null;
      for (const { start, value } of bs.items) {
        const props = resolveProps.resolveProps(start, {
          indicator: "seq-item-ind",
          next: value,
          offset,
          onError,
          parentIndent: bs.indent,
          startOnNewline: true
        });
        if (!props.found) {
          if (props.anchor || props.tag || value) {
            if (value?.type === "block-seq")
              onError(props.end, "BAD_INDENT", "All sequence items must start at the same column");
            else
              onError(offset, "MISSING_CHAR", "Sequence item without - indicator");
          } else {
            commentEnd = props.end;
            if (props.comment)
              seq.comment = props.comment;
            continue;
          }
        }
        const node = value ? composeNode(ctx, value, props, onError) : composeEmptyNode(ctx, props.end, start, null, props, onError);
        if (ctx.schema.compat)
          utilFlowIndentCheck.flowIndentCheck(bs.indent, value, onError);
        offset = node.range[2];
        seq.items.push(node);
      }
      seq.range = [bs.offset, offset, commentEnd ?? offset];
      return seq;
    }
    exports.resolveBlockSeq = resolveBlockSeq;
  }
});

// node_modules/yaml/dist/compose/resolve-end.js
var require_resolve_end = __commonJS({
  "node_modules/yaml/dist/compose/resolve-end.js"(exports) {
    "use strict";
    function resolveEnd(end, offset, reqSpace, onError) {
      let comment = "";
      if (end) {
        let hasSpace = false;
        let sep2 = "";
        for (const token of end) {
          const { source, type } = token;
          switch (type) {
            case "space":
              hasSpace = true;
              break;
            case "comment": {
              if (reqSpace && !hasSpace)
                onError(token, "MISSING_CHAR", "Comments must be separated from other tokens by white space characters");
              const cb = source.substring(1) || " ";
              if (!comment)
                comment = cb;
              else
                comment += sep2 + cb;
              sep2 = "";
              break;
            }
            case "newline":
              if (comment)
                sep2 += source;
              hasSpace = true;
              break;
            default:
              onError(token, "UNEXPECTED_TOKEN", `Unexpected ${type} at node end`);
          }
          offset += source.length;
        }
      }
      return { comment, offset };
    }
    exports.resolveEnd = resolveEnd;
  }
});

// node_modules/yaml/dist/compose/resolve-flow-collection.js
var require_resolve_flow_collection = __commonJS({
  "node_modules/yaml/dist/compose/resolve-flow-collection.js"(exports) {
    "use strict";
    var identity = require_identity();
    var Pair = require_Pair();
    var YAMLMap = require_YAMLMap();
    var YAMLSeq = require_YAMLSeq();
    var resolveEnd = require_resolve_end();
    var resolveProps = require_resolve_props();
    var utilContainsNewline = require_util_contains_newline();
    var utilMapIncludes = require_util_map_includes();
    var blockMsg = "Block collections are not allowed within flow collections";
    var isBlock = (token) => token && (token.type === "block-map" || token.type === "block-seq");
    function resolveFlowCollection({ composeNode, composeEmptyNode }, ctx, fc, onError, tag) {
      const isMap = fc.start.source === "{";
      const fcName = isMap ? "flow map" : "flow sequence";
      const NodeClass = tag?.nodeClass ?? (isMap ? YAMLMap.YAMLMap : YAMLSeq.YAMLSeq);
      const coll = new NodeClass(ctx.schema);
      coll.flow = true;
      const atRoot = ctx.atRoot;
      if (atRoot)
        ctx.atRoot = false;
      if (ctx.atKey)
        ctx.atKey = false;
      let offset = fc.offset + fc.start.source.length;
      for (let i = 0; i < fc.items.length; ++i) {
        const collItem = fc.items[i];
        const { start, key, sep: sep2, value } = collItem;
        const props = resolveProps.resolveProps(start, {
          flow: fcName,
          indicator: "explicit-key-ind",
          next: key ?? sep2?.[0],
          offset,
          onError,
          parentIndent: fc.indent,
          startOnNewline: false
        });
        if (!props.found) {
          if (!props.anchor && !props.tag && !sep2 && !value) {
            if (i === 0 && props.comma)
              onError(props.comma, "UNEXPECTED_TOKEN", `Unexpected , in ${fcName}`);
            else if (i < fc.items.length - 1)
              onError(props.start, "UNEXPECTED_TOKEN", `Unexpected empty item in ${fcName}`);
            if (props.comment) {
              if (coll.comment)
                coll.comment += "\n" + props.comment;
              else
                coll.comment = props.comment;
            }
            offset = props.end;
            continue;
          }
          if (!isMap && ctx.options.strict && utilContainsNewline.containsNewline(key))
            onError(
              key,
              // checked by containsNewline()
              "MULTILINE_IMPLICIT_KEY",
              "Implicit keys of flow sequence pairs need to be on a single line"
            );
        }
        if (i === 0) {
          if (props.comma)
            onError(props.comma, "UNEXPECTED_TOKEN", `Unexpected , in ${fcName}`);
        } else {
          if (!props.comma)
            onError(props.start, "MISSING_CHAR", `Missing , between ${fcName} items`);
          if (props.comment) {
            let prevItemComment = "";
            loop: for (const st of start) {
              switch (st.type) {
                case "comma":
                case "space":
                  break;
                case "comment":
                  prevItemComment = st.source.substring(1);
                  break loop;
                default:
                  break loop;
              }
            }
            if (prevItemComment) {
              let prev = coll.items[coll.items.length - 1];
              if (identity.isPair(prev))
                prev = prev.value ?? prev.key;
              if (prev.comment)
                prev.comment += "\n" + prevItemComment;
              else
                prev.comment = prevItemComment;
              props.comment = props.comment.substring(prevItemComment.length + 1);
            }
          }
        }
        if (!isMap && !sep2 && !props.found) {
          const valueNode = value ? composeNode(ctx, value, props, onError) : composeEmptyNode(ctx, props.end, sep2, null, props, onError);
          coll.items.push(valueNode);
          offset = valueNode.range[2];
          if (isBlock(value))
            onError(valueNode.range, "BLOCK_IN_FLOW", blockMsg);
        } else {
          ctx.atKey = true;
          const keyStart = props.end;
          const keyNode = key ? composeNode(ctx, key, props, onError) : composeEmptyNode(ctx, keyStart, start, null, props, onError);
          if (isBlock(key))
            onError(keyNode.range, "BLOCK_IN_FLOW", blockMsg);
          ctx.atKey = false;
          const valueProps = resolveProps.resolveProps(sep2 ?? [], {
            flow: fcName,
            indicator: "map-value-ind",
            next: value,
            offset: keyNode.range[2],
            onError,
            parentIndent: fc.indent,
            startOnNewline: false
          });
          if (valueProps.found) {
            if (!isMap && !props.found && ctx.options.strict) {
              if (sep2)
                for (const st of sep2) {
                  if (st === valueProps.found)
                    break;
                  if (st.type === "newline") {
                    onError(st, "MULTILINE_IMPLICIT_KEY", "Implicit keys of flow sequence pairs need to be on a single line");
                    break;
                  }
                }
              if (props.start < valueProps.found.offset - 1024)
                onError(valueProps.found, "KEY_OVER_1024_CHARS", "The : indicator must be at most 1024 chars after the start of an implicit flow sequence key");
            }
          } else if (value) {
            if ("source" in value && value.source?.[0] === ":")
              onError(value, "MISSING_CHAR", `Missing space after : in ${fcName}`);
            else
              onError(valueProps.start, "MISSING_CHAR", `Missing , or : between ${fcName} items`);
          }
          const valueNode = value ? composeNode(ctx, value, valueProps, onError) : valueProps.found ? composeEmptyNode(ctx, valueProps.end, sep2, null, valueProps, onError) : null;
          if (valueNode) {
            if (isBlock(value))
              onError(valueNode.range, "BLOCK_IN_FLOW", blockMsg);
          } else if (valueProps.comment) {
            if (keyNode.comment)
              keyNode.comment += "\n" + valueProps.comment;
            else
              keyNode.comment = valueProps.comment;
          }
          const pair = new Pair.Pair(keyNode, valueNode);
          if (ctx.options.keepSourceTokens)
            pair.srcToken = collItem;
          if (isMap) {
            const map = coll;
            if (utilMapIncludes.mapIncludes(ctx, map.items, keyNode))
              onError(keyStart, "DUPLICATE_KEY", "Map keys must be unique");
            map.items.push(pair);
          } else {
            const map = new YAMLMap.YAMLMap(ctx.schema);
            map.flow = true;
            map.items.push(pair);
            const endRange = (valueNode ?? keyNode).range;
            map.range = [keyNode.range[0], endRange[1], endRange[2]];
            coll.items.push(map);
          }
          offset = valueNode ? valueNode.range[2] : valueProps.end;
        }
      }
      const expectedEnd = isMap ? "}" : "]";
      const [ce, ...ee] = fc.end;
      let cePos = offset;
      if (ce?.source === expectedEnd)
        cePos = ce.offset + ce.source.length;
      else {
        const name = fcName[0].toUpperCase() + fcName.substring(1);
        const msg = atRoot ? `${name} must end with a ${expectedEnd}` : `${name} in block collection must be sufficiently indented and end with a ${expectedEnd}`;
        onError(offset, atRoot ? "MISSING_CHAR" : "BAD_INDENT", msg);
        if (ce && ce.source.length !== 1)
          ee.unshift(ce);
      }
      if (ee.length > 0) {
        const end = resolveEnd.resolveEnd(ee, cePos, ctx.options.strict, onError);
        if (end.comment) {
          if (coll.comment)
            coll.comment += "\n" + end.comment;
          else
            coll.comment = end.comment;
        }
        coll.range = [fc.offset, cePos, end.offset];
      } else {
        coll.range = [fc.offset, cePos, cePos];
      }
      return coll;
    }
    exports.resolveFlowCollection = resolveFlowCollection;
  }
});

// node_modules/yaml/dist/compose/compose-collection.js
var require_compose_collection = __commonJS({
  "node_modules/yaml/dist/compose/compose-collection.js"(exports) {
    "use strict";
    var identity = require_identity();
    var Scalar = require_Scalar();
    var YAMLMap = require_YAMLMap();
    var YAMLSeq = require_YAMLSeq();
    var resolveBlockMap = require_resolve_block_map();
    var resolveBlockSeq = require_resolve_block_seq();
    var resolveFlowCollection = require_resolve_flow_collection();
    function resolveCollection(CN, ctx, token, onError, tagName, tag) {
      const coll = token.type === "block-map" ? resolveBlockMap.resolveBlockMap(CN, ctx, token, onError, tag) : token.type === "block-seq" ? resolveBlockSeq.resolveBlockSeq(CN, ctx, token, onError, tag) : resolveFlowCollection.resolveFlowCollection(CN, ctx, token, onError, tag);
      const Coll = coll.constructor;
      if (tagName === "!" || tagName === Coll.tagName) {
        coll.tag = Coll.tagName;
        return coll;
      }
      if (tagName)
        coll.tag = tagName;
      return coll;
    }
    function composeCollection(CN, ctx, token, props, onError) {
      const tagToken = props.tag;
      const tagName = !tagToken ? null : ctx.directives.tagName(tagToken.source, (msg) => onError(tagToken, "TAG_RESOLVE_FAILED", msg));
      if (token.type === "block-seq") {
        const { anchor, newlineAfterProp: nl } = props;
        const lastProp = anchor && tagToken ? anchor.offset > tagToken.offset ? anchor : tagToken : anchor ?? tagToken;
        if (lastProp && (!nl || nl.offset < lastProp.offset)) {
          const message = "Missing newline after block sequence props";
          onError(lastProp, "MISSING_CHAR", message);
        }
      }
      const expType = token.type === "block-map" ? "map" : token.type === "block-seq" ? "seq" : token.start.source === "{" ? "map" : "seq";
      if (!tagToken || !tagName || tagName === "!" || tagName === YAMLMap.YAMLMap.tagName && expType === "map" || tagName === YAMLSeq.YAMLSeq.tagName && expType === "seq") {
        return resolveCollection(CN, ctx, token, onError, tagName);
      }
      let tag = ctx.schema.tags.find((t) => t.tag === tagName && t.collection === expType);
      if (!tag) {
        const kt = ctx.schema.knownTags[tagName];
        if (kt?.collection === expType) {
          ctx.schema.tags.push(Object.assign({}, kt, { default: false }));
          tag = kt;
        } else {
          if (kt) {
            onError(tagToken, "BAD_COLLECTION_TYPE", `${kt.tag} used for ${expType} collection, but expects ${kt.collection ?? "scalar"}`, true);
          } else {
            onError(tagToken, "TAG_RESOLVE_FAILED", `Unresolved tag: ${tagName}`, true);
          }
          return resolveCollection(CN, ctx, token, onError, tagName);
        }
      }
      const coll = resolveCollection(CN, ctx, token, onError, tagName, tag);
      const res = tag.resolve?.(coll, (msg) => onError(tagToken, "TAG_RESOLVE_FAILED", msg), ctx.options) ?? coll;
      const node = identity.isNode(res) ? res : new Scalar.Scalar(res);
      node.range = coll.range;
      node.tag = tagName;
      if (tag?.format)
        node.format = tag.format;
      return node;
    }
    exports.composeCollection = composeCollection;
  }
});

// node_modules/yaml/dist/compose/resolve-block-scalar.js
var require_resolve_block_scalar = __commonJS({
  "node_modules/yaml/dist/compose/resolve-block-scalar.js"(exports) {
    "use strict";
    var Scalar = require_Scalar();
    function resolveBlockScalar(ctx, scalar, onError) {
      const start = scalar.offset;
      const header = parseBlockScalarHeader(scalar, ctx.options.strict, onError);
      if (!header)
        return { value: "", type: null, comment: "", range: [start, start, start] };
      const type = header.mode === ">" ? Scalar.Scalar.BLOCK_FOLDED : Scalar.Scalar.BLOCK_LITERAL;
      const lines = scalar.source ? splitLines(scalar.source) : [];
      let chompStart = lines.length;
      for (let i = lines.length - 1; i >= 0; --i) {
        const content = lines[i][1];
        if (content === "" || content === "\r")
          chompStart = i;
        else
          break;
      }
      if (chompStart === 0) {
        const value2 = header.chomp === "+" && lines.length > 0 ? "\n".repeat(Math.max(1, lines.length - 1)) : "";
        let end2 = start + header.length;
        if (scalar.source)
          end2 += scalar.source.length;
        return { value: value2, type, comment: header.comment, range: [start, end2, end2] };
      }
      let trimIndent = scalar.indent + header.indent;
      let offset = scalar.offset + header.length;
      let contentStart = 0;
      for (let i = 0; i < chompStart; ++i) {
        const [indent, content] = lines[i];
        if (content === "" || content === "\r") {
          if (header.indent === 0 && indent.length > trimIndent)
            trimIndent = indent.length;
        } else {
          if (indent.length < trimIndent) {
            const message = "Block scalars with more-indented leading empty lines must use an explicit indentation indicator";
            onError(offset + indent.length, "MISSING_CHAR", message);
          }
          if (header.indent === 0)
            trimIndent = indent.length;
          contentStart = i;
          if (trimIndent === 0 && !ctx.atRoot) {
            const message = "Block scalar values in collections must be indented";
            onError(offset, "BAD_INDENT", message);
          }
          break;
        }
        offset += indent.length + content.length + 1;
      }
      for (let i = lines.length - 1; i >= chompStart; --i) {
        if (lines[i][0].length > trimIndent)
          chompStart = i + 1;
      }
      let value = "";
      let sep2 = "";
      let prevMoreIndented = false;
      for (let i = 0; i < contentStart; ++i)
        value += lines[i][0].slice(trimIndent) + "\n";
      for (let i = contentStart; i < chompStart; ++i) {
        let [indent, content] = lines[i];
        offset += indent.length + content.length + 1;
        const crlf = content[content.length - 1] === "\r";
        if (crlf)
          content = content.slice(0, -1);
        if (content && indent.length < trimIndent) {
          const src = header.indent ? "explicit indentation indicator" : "first line";
          const message = `Block scalar lines must not be less indented than their ${src}`;
          onError(offset - content.length - (crlf ? 2 : 1), "BAD_INDENT", message);
          indent = "";
        }
        if (type === Scalar.Scalar.BLOCK_LITERAL) {
          value += sep2 + indent.slice(trimIndent) + content;
          sep2 = "\n";
        } else if (indent.length > trimIndent || content[0] === "	") {
          if (sep2 === " ")
            sep2 = "\n";
          else if (!prevMoreIndented && sep2 === "\n")
            sep2 = "\n\n";
          value += sep2 + indent.slice(trimIndent) + content;
          sep2 = "\n";
          prevMoreIndented = true;
        } else if (content === "") {
          if (sep2 === "\n")
            value += "\n";
          else
            sep2 = "\n";
        } else {
          value += sep2 + content;
          sep2 = " ";
          prevMoreIndented = false;
        }
      }
      switch (header.chomp) {
        case "-":
          break;
        case "+":
          for (let i = chompStart; i < lines.length; ++i)
            value += "\n" + lines[i][0].slice(trimIndent);
          if (value[value.length - 1] !== "\n")
            value += "\n";
          break;
        default:
          value += "\n";
      }
      const end = start + header.length + scalar.source.length;
      return { value, type, comment: header.comment, range: [start, end, end] };
    }
    function parseBlockScalarHeader({ offset, props }, strict, onError) {
      if (props[0].type !== "block-scalar-header") {
        onError(props[0], "IMPOSSIBLE", "Block scalar header not found");
        return null;
      }
      const { source } = props[0];
      const mode = source[0];
      let indent = 0;
      let chomp = "";
      let error = -1;
      for (let i = 1; i < source.length; ++i) {
        const ch = source[i];
        if (!chomp && (ch === "-" || ch === "+"))
          chomp = ch;
        else {
          const n = Number(ch);
          if (!indent && n)
            indent = n;
          else if (error === -1)
            error = offset + i;
        }
      }
      if (error !== -1)
        onError(error, "UNEXPECTED_TOKEN", `Block scalar header includes extra characters: ${source}`);
      let hasSpace = false;
      let comment = "";
      let length = source.length;
      for (let i = 1; i < props.length; ++i) {
        const token = props[i];
        switch (token.type) {
          case "space":
            hasSpace = true;
          // fallthrough
          case "newline":
            length += token.source.length;
            break;
          case "comment":
            if (strict && !hasSpace) {
              const message = "Comments must be separated from other tokens by white space characters";
              onError(token, "MISSING_CHAR", message);
            }
            length += token.source.length;
            comment = token.source.substring(1);
            break;
          case "error":
            onError(token, "UNEXPECTED_TOKEN", token.message);
            length += token.source.length;
            break;
          /* istanbul ignore next should not happen */
          default: {
            const message = `Unexpected token in block scalar header: ${token.type}`;
            onError(token, "UNEXPECTED_TOKEN", message);
            const ts = token.source;
            if (ts && typeof ts === "string")
              length += ts.length;
          }
        }
      }
      return { mode, indent, chomp, comment, length };
    }
    function splitLines(source) {
      const split = source.split(/\n( *)/);
      const first = split[0];
      const m = first.match(/^( *)/);
      const line0 = m?.[1] ? [m[1], first.slice(m[1].length)] : ["", first];
      const lines = [line0];
      for (let i = 1; i < split.length; i += 2)
        lines.push([split[i], split[i + 1]]);
      return lines;
    }
    exports.resolveBlockScalar = resolveBlockScalar;
  }
});

// node_modules/yaml/dist/compose/resolve-flow-scalar.js
var require_resolve_flow_scalar = __commonJS({
  "node_modules/yaml/dist/compose/resolve-flow-scalar.js"(exports) {
    "use strict";
    var Scalar = require_Scalar();
    var resolveEnd = require_resolve_end();
    function resolveFlowScalar(scalar, strict, onError) {
      const { offset, type, source, end } = scalar;
      let _type;
      let value;
      const _onError = (rel, code, msg) => onError(offset + rel, code, msg);
      switch (type) {
        case "scalar":
          _type = Scalar.Scalar.PLAIN;
          value = plainValue(source, _onError);
          break;
        case "single-quoted-scalar":
          _type = Scalar.Scalar.QUOTE_SINGLE;
          value = singleQuotedValue(source, _onError);
          break;
        case "double-quoted-scalar":
          _type = Scalar.Scalar.QUOTE_DOUBLE;
          value = doubleQuotedValue(source, _onError);
          break;
        /* istanbul ignore next should not happen */
        default:
          onError(scalar, "UNEXPECTED_TOKEN", `Expected a flow scalar value, but found: ${type}`);
          return {
            value: "",
            type: null,
            comment: "",
            range: [offset, offset + source.length, offset + source.length]
          };
      }
      const valueEnd = offset + source.length;
      const re = resolveEnd.resolveEnd(end, valueEnd, strict, onError);
      return {
        value,
        type: _type,
        comment: re.comment,
        range: [offset, valueEnd, re.offset]
      };
    }
    function plainValue(source, onError) {
      let badChar = "";
      switch (source[0]) {
        /* istanbul ignore next should not happen */
        case "	":
          badChar = "a tab character";
          break;
        case ",":
          badChar = "flow indicator character ,";
          break;
        case "%":
          badChar = "directive indicator character %";
          break;
        case "|":
        case ">": {
          badChar = `block scalar indicator ${source[0]}`;
          break;
        }
        case "@":
        case "`": {
          badChar = `reserved character ${source[0]}`;
          break;
        }
      }
      if (badChar)
        onError(0, "BAD_SCALAR_START", `Plain value cannot start with ${badChar}`);
      return foldLines(source);
    }
    function singleQuotedValue(source, onError) {
      if (source[source.length - 1] !== "'" || source.length === 1)
        onError(source.length, "MISSING_CHAR", "Missing closing 'quote");
      return foldLines(source.slice(1, -1)).replace(/''/g, "'");
    }
    function foldLines(source) {
      let first, line;
      try {
        first = new RegExp("(.*?)(?<![ 	])[ 	]*\r?\n", "sy");
        line = new RegExp("[ 	]*(.*?)(?:(?<![ 	])[ 	]*)?\r?\n", "sy");
      } catch {
        first = /(.*?)[ \t]*\r?\n/sy;
        line = /[ \t]*(.*?)[ \t]*\r?\n/sy;
      }
      let match = first.exec(source);
      if (!match)
        return source;
      let res = match[1];
      let sep2 = " ";
      let pos = first.lastIndex;
      line.lastIndex = pos;
      while (match = line.exec(source)) {
        if (match[1] === "") {
          if (sep2 === "\n")
            res += sep2;
          else
            sep2 = "\n";
        } else {
          res += sep2 + match[1];
          sep2 = " ";
        }
        pos = line.lastIndex;
      }
      const last = /[ \t]*(.*)/sy;
      last.lastIndex = pos;
      match = last.exec(source);
      return res + sep2 + (match?.[1] ?? "");
    }
    function doubleQuotedValue(source, onError) {
      let res = "";
      for (let i = 1; i < source.length - 1; ++i) {
        const ch = source[i];
        if (ch === "\r" && source[i + 1] === "\n")
          continue;
        if (ch === "\n") {
          const { fold, offset } = foldNewline(source, i);
          res += fold;
          i = offset;
        } else if (ch === "\\") {
          let next = source[++i];
          const cc = escapeCodes[next];
          if (cc)
            res += cc;
          else if (next === "\n") {
            next = source[i + 1];
            while (next === " " || next === "	")
              next = source[++i + 1];
          } else if (next === "\r" && source[i + 1] === "\n") {
            next = source[++i + 1];
            while (next === " " || next === "	")
              next = source[++i + 1];
          } else if (next === "x" || next === "u" || next === "U") {
            const length = { x: 2, u: 4, U: 8 }[next];
            res += parseCharCode(source, i + 1, length, onError);
            i += length;
          } else {
            const raw = source.substr(i - 1, 2);
            onError(i - 1, "BAD_DQ_ESCAPE", `Invalid escape sequence ${raw}`);
            res += raw;
          }
        } else if (ch === " " || ch === "	") {
          const wsStart = i;
          let next = source[i + 1];
          while (next === " " || next === "	")
            next = source[++i + 1];
          if (next !== "\n" && !(next === "\r" && source[i + 2] === "\n"))
            res += i > wsStart ? source.slice(wsStart, i + 1) : ch;
        } else {
          res += ch;
        }
      }
      if (source[source.length - 1] !== '"' || source.length === 1)
        onError(source.length, "MISSING_CHAR", 'Missing closing "quote');
      return res;
    }
    function foldNewline(source, offset) {
      let fold = "";
      let ch = source[offset + 1];
      while (ch === " " || ch === "	" || ch === "\n" || ch === "\r") {
        if (ch === "\r" && source[offset + 2] !== "\n")
          break;
        if (ch === "\n")
          fold += "\n";
        offset += 1;
        ch = source[offset + 1];
      }
      if (!fold)
        fold = " ";
      return { fold, offset };
    }
    var escapeCodes = {
      "0": "\0",
      // null character
      a: "\x07",
      // bell character
      b: "\b",
      // backspace
      e: "\x1B",
      // escape character
      f: "\f",
      // form feed
      n: "\n",
      // line feed
      r: "\r",
      // carriage return
      t: "	",
      // horizontal tab
      v: "\v",
      // vertical tab
      N: "\x85",
      // Unicode next line
      _: "\xA0",
      // Unicode non-breaking space
      L: "\u2028",
      // Unicode line separator
      P: "\u2029",
      // Unicode paragraph separator
      " ": " ",
      '"': '"',
      "/": "/",
      "\\": "\\",
      "	": "	"
    };
    function parseCharCode(source, offset, length, onError) {
      const cc = source.substr(offset, length);
      const ok = cc.length === length && /^[0-9a-fA-F]+$/.test(cc);
      const code = ok ? parseInt(cc, 16) : NaN;
      if (isNaN(code)) {
        const raw = source.substr(offset - 2, length + 2);
        onError(offset - 2, "BAD_DQ_ESCAPE", `Invalid escape sequence ${raw}`);
        return raw;
      }
      return String.fromCodePoint(code);
    }
    exports.resolveFlowScalar = resolveFlowScalar;
  }
});

// node_modules/yaml/dist/compose/compose-scalar.js
var require_compose_scalar = __commonJS({
  "node_modules/yaml/dist/compose/compose-scalar.js"(exports) {
    "use strict";
    var identity = require_identity();
    var Scalar = require_Scalar();
    var resolveBlockScalar = require_resolve_block_scalar();
    var resolveFlowScalar = require_resolve_flow_scalar();
    function composeScalar(ctx, token, tagToken, onError) {
      const { value, type, comment, range } = token.type === "block-scalar" ? resolveBlockScalar.resolveBlockScalar(ctx, token, onError) : resolveFlowScalar.resolveFlowScalar(token, ctx.options.strict, onError);
      const tagName = tagToken ? ctx.directives.tagName(tagToken.source, (msg) => onError(tagToken, "TAG_RESOLVE_FAILED", msg)) : null;
      let tag;
      if (ctx.options.stringKeys && ctx.atKey) {
        tag = ctx.schema[identity.SCALAR];
      } else if (tagName)
        tag = findScalarTagByName(ctx.schema, value, tagName, tagToken, onError);
      else if (token.type === "scalar")
        tag = findScalarTagByTest(ctx, value, token, onError);
      else
        tag = ctx.schema[identity.SCALAR];
      let scalar;
      try {
        const res = tag.resolve(value, (msg) => onError(tagToken ?? token, "TAG_RESOLVE_FAILED", msg), ctx.options);
        scalar = identity.isScalar(res) ? res : new Scalar.Scalar(res);
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        onError(tagToken ?? token, "TAG_RESOLVE_FAILED", msg);
        scalar = new Scalar.Scalar(value);
      }
      scalar.range = range;
      scalar.source = value;
      if (type)
        scalar.type = type;
      if (tagName)
        scalar.tag = tagName;
      if (tag.format)
        scalar.format = tag.format;
      if (comment)
        scalar.comment = comment;
      return scalar;
    }
    function findScalarTagByName(schema, value, tagName, tagToken, onError) {
      if (tagName === "!")
        return schema[identity.SCALAR];
      const matchWithTest = [];
      for (const tag of schema.tags) {
        if (!tag.collection && tag.tag === tagName) {
          if (tag.default && tag.test)
            matchWithTest.push(tag);
          else
            return tag;
        }
      }
      for (const tag of matchWithTest)
        if (tag.test?.test(value))
          return tag;
      const kt = schema.knownTags[tagName];
      if (kt && !kt.collection) {
        schema.tags.push(Object.assign({}, kt, { default: false, test: void 0 }));
        return kt;
      }
      onError(tagToken, "TAG_RESOLVE_FAILED", `Unresolved tag: ${tagName}`, tagName !== "tag:yaml.org,2002:str");
      return schema[identity.SCALAR];
    }
    function findScalarTagByTest({ atKey, directives, schema }, value, token, onError) {
      const tag = schema.tags.find((tag2) => (tag2.default === true || atKey && tag2.default === "key") && tag2.test?.test(value)) || schema[identity.SCALAR];
      if (schema.compat) {
        const compat = schema.compat.find((tag2) => tag2.default && tag2.test?.test(value)) ?? schema[identity.SCALAR];
        if (tag.tag !== compat.tag) {
          const ts = directives.tagString(tag.tag);
          const cs = directives.tagString(compat.tag);
          const msg = `Value may be parsed as either ${ts} or ${cs}`;
          onError(token, "TAG_RESOLVE_FAILED", msg, true);
        }
      }
      return tag;
    }
    exports.composeScalar = composeScalar;
  }
});

// node_modules/yaml/dist/compose/util-empty-scalar-position.js
var require_util_empty_scalar_position = __commonJS({
  "node_modules/yaml/dist/compose/util-empty-scalar-position.js"(exports) {
    "use strict";
    function emptyScalarPosition(offset, before, pos) {
      if (before) {
        pos ?? (pos = before.length);
        for (let i = pos - 1; i >= 0; --i) {
          let st = before[i];
          switch (st.type) {
            case "space":
            case "comment":
            case "newline":
              offset -= st.source.length;
              continue;
          }
          st = before[++i];
          while (st?.type === "space") {
            offset += st.source.length;
            st = before[++i];
          }
          break;
        }
      }
      return offset;
    }
    exports.emptyScalarPosition = emptyScalarPosition;
  }
});

// node_modules/yaml/dist/compose/compose-node.js
var require_compose_node = __commonJS({
  "node_modules/yaml/dist/compose/compose-node.js"(exports) {
    "use strict";
    var Alias = require_Alias();
    var identity = require_identity();
    var composeCollection = require_compose_collection();
    var composeScalar = require_compose_scalar();
    var resolveEnd = require_resolve_end();
    var utilEmptyScalarPosition = require_util_empty_scalar_position();
    var CN = { composeNode, composeEmptyNode };
    function composeNode(ctx, token, props, onError) {
      const atKey = ctx.atKey;
      const { spaceBefore, comment, anchor, tag } = props;
      let node;
      let isSrcToken = true;
      switch (token.type) {
        case "alias":
          node = composeAlias(ctx, token, onError);
          if (anchor || tag)
            onError(token, "ALIAS_PROPS", "An alias node must not specify any properties");
          break;
        case "scalar":
        case "single-quoted-scalar":
        case "double-quoted-scalar":
        case "block-scalar":
          node = composeScalar.composeScalar(ctx, token, tag, onError);
          if (anchor)
            node.anchor = anchor.source.substring(1);
          break;
        case "block-map":
        case "block-seq":
        case "flow-collection":
          try {
            node = composeCollection.composeCollection(CN, ctx, token, props, onError);
            if (anchor)
              node.anchor = anchor.source.substring(1);
          } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            onError(token, "RESOURCE_EXHAUSTION", message);
          }
          break;
        default: {
          const message = token.type === "error" ? token.message : `Unsupported token (type: ${token.type})`;
          onError(token, "UNEXPECTED_TOKEN", message);
          isSrcToken = false;
        }
      }
      node ?? (node = composeEmptyNode(ctx, token.offset, void 0, null, props, onError));
      if (anchor && node.anchor === "")
        onError(anchor, "BAD_ALIAS", "Anchor cannot be an empty string");
      if (atKey && ctx.options.stringKeys && (!identity.isScalar(node) || typeof node.value !== "string" || node.tag && node.tag !== "tag:yaml.org,2002:str")) {
        const msg = "With stringKeys, all keys must be strings";
        onError(tag ?? token, "NON_STRING_KEY", msg);
      }
      if (spaceBefore)
        node.spaceBefore = true;
      if (comment) {
        if (token.type === "scalar" && token.source === "")
          node.comment = comment;
        else
          node.commentBefore = comment;
      }
      if (ctx.options.keepSourceTokens && isSrcToken)
        node.srcToken = token;
      return node;
    }
    function composeEmptyNode(ctx, offset, before, pos, { spaceBefore, comment, anchor, tag, end }, onError) {
      const token = {
        type: "scalar",
        offset: utilEmptyScalarPosition.emptyScalarPosition(offset, before, pos),
        indent: -1,
        source: ""
      };
      const node = composeScalar.composeScalar(ctx, token, tag, onError);
      if (anchor) {
        node.anchor = anchor.source.substring(1);
        if (node.anchor === "")
          onError(anchor, "BAD_ALIAS", "Anchor cannot be an empty string");
      }
      if (spaceBefore)
        node.spaceBefore = true;
      if (comment) {
        node.comment = comment;
        node.range[2] = end;
      }
      return node;
    }
    function composeAlias({ options }, { offset, source, end }, onError) {
      const alias = new Alias.Alias(source.substring(1));
      if (alias.source === "")
        onError(offset, "BAD_ALIAS", "Alias cannot be an empty string");
      if (alias.source.endsWith(":"))
        onError(offset + source.length - 1, "BAD_ALIAS", "Alias ending in : is ambiguous", true);
      const valueEnd = offset + source.length;
      const re = resolveEnd.resolveEnd(end, valueEnd, options.strict, onError);
      alias.range = [offset, valueEnd, re.offset];
      if (re.comment)
        alias.comment = re.comment;
      return alias;
    }
    exports.composeEmptyNode = composeEmptyNode;
    exports.composeNode = composeNode;
  }
});

// node_modules/yaml/dist/compose/compose-doc.js
var require_compose_doc = __commonJS({
  "node_modules/yaml/dist/compose/compose-doc.js"(exports) {
    "use strict";
    var Document = require_Document();
    var composeNode = require_compose_node();
    var resolveEnd = require_resolve_end();
    var resolveProps = require_resolve_props();
    function composeDoc(options, directives, { offset, start, value, end }, onError) {
      const opts = Object.assign({ _directives: directives }, options);
      const doc = new Document.Document(void 0, opts);
      const ctx = {
        atKey: false,
        atRoot: true,
        directives: doc.directives,
        options: doc.options,
        schema: doc.schema
      };
      const props = resolveProps.resolveProps(start, {
        indicator: "doc-start",
        next: value ?? end?.[0],
        offset,
        onError,
        parentIndent: 0,
        startOnNewline: true
      });
      if (props.found) {
        doc.directives.docStart = true;
        if (value && (value.type === "block-map" || value.type === "block-seq") && !props.hasNewline)
          onError(props.end, "MISSING_CHAR", "Block collection cannot start on same line with directives-end marker");
      }
      doc.contents = value ? composeNode.composeNode(ctx, value, props, onError) : composeNode.composeEmptyNode(ctx, props.end, start, null, props, onError);
      const contentEnd = doc.contents.range[2];
      const re = resolveEnd.resolveEnd(end, contentEnd, false, onError);
      if (re.comment)
        doc.comment = re.comment;
      doc.range = [offset, contentEnd, re.offset];
      return doc;
    }
    exports.composeDoc = composeDoc;
  }
});

// node_modules/yaml/dist/compose/composer.js
var require_composer = __commonJS({
  "node_modules/yaml/dist/compose/composer.js"(exports) {
    "use strict";
    var node_process = __require("process");
    var directives = require_directives();
    var Document = require_Document();
    var errors = require_errors();
    var identity = require_identity();
    var composeDoc = require_compose_doc();
    var resolveEnd = require_resolve_end();
    function getErrorPos(src) {
      if (typeof src === "number")
        return [src, src + 1];
      if (Array.isArray(src))
        return src.length === 2 ? src : [src[0], src[1]];
      const { offset, source } = src;
      return [offset, offset + (typeof source === "string" ? source.length : 1)];
    }
    function parsePrelude(prelude) {
      let comment = "";
      let atComment = false;
      let afterEmptyLine = false;
      for (let i = 0; i < prelude.length; ++i) {
        const source = prelude[i];
        switch (source[0]) {
          case "#":
            comment += (comment === "" ? "" : afterEmptyLine ? "\n\n" : "\n") + (source.substring(1) || " ");
            atComment = true;
            afterEmptyLine = false;
            break;
          case "%":
            if (prelude[i + 1]?.[0] !== "#")
              i += 1;
            atComment = false;
            break;
          default:
            if (!atComment)
              afterEmptyLine = true;
            atComment = false;
        }
      }
      return { comment, afterEmptyLine };
    }
    var Composer = class {
      constructor(options = {}) {
        this.doc = null;
        this.atDirectives = false;
        this.prelude = [];
        this.errors = [];
        this.warnings = [];
        this.onError = (source, code, message, warning) => {
          const pos = getErrorPos(source);
          if (warning)
            this.warnings.push(new errors.YAMLWarning(pos, code, message));
          else
            this.errors.push(new errors.YAMLParseError(pos, code, message));
        };
        this.directives = new directives.Directives({ version: options.version || "1.2" });
        this.options = options;
      }
      decorate(doc, afterDoc) {
        const { comment, afterEmptyLine } = parsePrelude(this.prelude);
        if (comment) {
          const dc = doc.contents;
          if (afterDoc) {
            doc.comment = doc.comment ? `${doc.comment}
${comment}` : comment;
          } else if (afterEmptyLine || doc.directives.docStart || !dc) {
            doc.commentBefore = comment;
          } else if (identity.isCollection(dc) && !dc.flow && dc.items.length > 0) {
            let it = dc.items[0];
            if (identity.isPair(it))
              it = it.key;
            const cb = it.commentBefore;
            it.commentBefore = cb ? `${comment}
${cb}` : comment;
          } else {
            const cb = dc.commentBefore;
            dc.commentBefore = cb ? `${comment}
${cb}` : comment;
          }
        }
        if (afterDoc) {
          Array.prototype.push.apply(doc.errors, this.errors);
          Array.prototype.push.apply(doc.warnings, this.warnings);
        } else {
          doc.errors = this.errors;
          doc.warnings = this.warnings;
        }
        this.prelude = [];
        this.errors = [];
        this.warnings = [];
      }
      /**
       * Current stream status information.
       *
       * Mostly useful at the end of input for an empty stream.
       */
      streamInfo() {
        return {
          comment: parsePrelude(this.prelude).comment,
          directives: this.directives,
          errors: this.errors,
          warnings: this.warnings
        };
      }
      /**
       * Compose tokens into documents.
       *
       * @param forceDoc - If the stream contains no document, still emit a final document including any comments and directives that would be applied to a subsequent document.
       * @param endOffset - Should be set if `forceDoc` is also set, to set the document range end and to indicate errors correctly.
       */
      *compose(tokens, forceDoc = false, endOffset = -1) {
        for (const token of tokens)
          yield* this.next(token);
        yield* this.end(forceDoc, endOffset);
      }
      /** Advance the composer by one CST token. */
      *next(token) {
        if (node_process.env.LOG_STREAM)
          console.dir(token, { depth: null });
        switch (token.type) {
          case "directive":
            this.directives.add(token.source, (offset, message, warning) => {
              const pos = getErrorPos(token);
              pos[0] += offset;
              this.onError(pos, "BAD_DIRECTIVE", message, warning);
            });
            this.prelude.push(token.source);
            this.atDirectives = true;
            break;
          case "document": {
            const doc = composeDoc.composeDoc(this.options, this.directives, token, this.onError);
            if (this.atDirectives && !doc.directives.docStart)
              this.onError(token, "MISSING_CHAR", "Missing directives-end/doc-start indicator line");
            this.decorate(doc, false);
            if (this.doc)
              yield this.doc;
            this.doc = doc;
            this.atDirectives = false;
            break;
          }
          case "byte-order-mark":
          case "space":
            break;
          case "comment":
          case "newline":
            this.prelude.push(token.source);
            break;
          case "error": {
            const msg = token.source ? `${token.message}: ${JSON.stringify(token.source)}` : token.message;
            const error = new errors.YAMLParseError(getErrorPos(token), "UNEXPECTED_TOKEN", msg);
            if (this.atDirectives || !this.doc)
              this.errors.push(error);
            else
              this.doc.errors.push(error);
            break;
          }
          case "doc-end": {
            if (!this.doc) {
              const msg = "Unexpected doc-end without preceding document";
              this.errors.push(new errors.YAMLParseError(getErrorPos(token), "UNEXPECTED_TOKEN", msg));
              break;
            }
            this.doc.directives.docEnd = true;
            const end = resolveEnd.resolveEnd(token.end, token.offset + token.source.length, this.doc.options.strict, this.onError);
            this.decorate(this.doc, true);
            if (end.comment) {
              const dc = this.doc.comment;
              this.doc.comment = dc ? `${dc}
${end.comment}` : end.comment;
            }
            this.doc.range[2] = end.offset;
            break;
          }
          default:
            this.errors.push(new errors.YAMLParseError(getErrorPos(token), "UNEXPECTED_TOKEN", `Unsupported token ${token.type}`));
        }
      }
      /**
       * Call at end of input to yield any remaining document.
       *
       * @param forceDoc - If the stream contains no document, still emit a final document including any comments and directives that would be applied to a subsequent document.
       * @param endOffset - Should be set if `forceDoc` is also set, to set the document range end and to indicate errors correctly.
       */
      *end(forceDoc = false, endOffset = -1) {
        if (this.doc) {
          this.decorate(this.doc, true);
          yield this.doc;
          this.doc = null;
        } else if (forceDoc) {
          const opts = Object.assign({ _directives: this.directives }, this.options);
          const doc = new Document.Document(void 0, opts);
          if (this.atDirectives)
            this.onError(endOffset, "MISSING_CHAR", "Missing directives-end indicator line");
          doc.range = [0, endOffset, endOffset];
          this.decorate(doc, false);
          yield doc;
        }
      }
    };
    exports.Composer = Composer;
  }
});

// node_modules/yaml/dist/parse/cst-scalar.js
var require_cst_scalar = __commonJS({
  "node_modules/yaml/dist/parse/cst-scalar.js"(exports) {
    "use strict";
    var resolveBlockScalar = require_resolve_block_scalar();
    var resolveFlowScalar = require_resolve_flow_scalar();
    var errors = require_errors();
    var stringifyString = require_stringifyString();
    function resolveAsScalar(token, strict = true, onError) {
      if (token) {
        const _onError = (pos, code, message) => {
          const offset = typeof pos === "number" ? pos : Array.isArray(pos) ? pos[0] : pos.offset;
          if (onError)
            onError(offset, code, message);
          else
            throw new errors.YAMLParseError([offset, offset + 1], code, message);
        };
        switch (token.type) {
          case "scalar":
          case "single-quoted-scalar":
          case "double-quoted-scalar":
            return resolveFlowScalar.resolveFlowScalar(token, strict, _onError);
          case "block-scalar":
            return resolveBlockScalar.resolveBlockScalar({ options: { strict } }, token, _onError);
        }
      }
      return null;
    }
    function createScalarToken(value, context) {
      const { implicitKey = false, indent, inFlow = false, offset = -1, type = "PLAIN" } = context;
      const source = stringifyString.stringifyString({ type, value }, {
        implicitKey,
        indent: indent > 0 ? " ".repeat(indent) : "",
        inFlow,
        options: { blockQuote: true, lineWidth: -1 }
      });
      const end = context.end ?? [
        { type: "newline", offset: -1, indent, source: "\n" }
      ];
      switch (source[0]) {
        case "|":
        case ">": {
          const he = source.indexOf("\n");
          const head = source.substring(0, he);
          const body = source.substring(he + 1) + "\n";
          const props = [
            { type: "block-scalar-header", offset, indent, source: head }
          ];
          if (!addEndtoBlockProps(props, end))
            props.push({ type: "newline", offset: -1, indent, source: "\n" });
          return { type: "block-scalar", offset, indent, props, source: body };
        }
        case '"':
          return { type: "double-quoted-scalar", offset, indent, source, end };
        case "'":
          return { type: "single-quoted-scalar", offset, indent, source, end };
        default:
          return { type: "scalar", offset, indent, source, end };
      }
    }
    function setScalarValue(token, value, context = {}) {
      let { afterKey = false, implicitKey = false, inFlow = false, type } = context;
      let indent = "indent" in token ? token.indent : null;
      if (afterKey && typeof indent === "number")
        indent += 2;
      if (!type)
        switch (token.type) {
          case "single-quoted-scalar":
            type = "QUOTE_SINGLE";
            break;
          case "double-quoted-scalar":
            type = "QUOTE_DOUBLE";
            break;
          case "block-scalar": {
            const header = token.props[0];
            if (header.type !== "block-scalar-header")
              throw new Error("Invalid block scalar header");
            type = header.source[0] === ">" ? "BLOCK_FOLDED" : "BLOCK_LITERAL";
            break;
          }
          default:
            type = "PLAIN";
        }
      const source = stringifyString.stringifyString({ type, value }, {
        implicitKey: implicitKey || indent === null,
        indent: indent !== null && indent > 0 ? " ".repeat(indent) : "",
        inFlow,
        options: { blockQuote: true, lineWidth: -1 }
      });
      switch (source[0]) {
        case "|":
        case ">":
          setBlockScalarValue(token, source);
          break;
        case '"':
          setFlowScalarValue(token, source, "double-quoted-scalar");
          break;
        case "'":
          setFlowScalarValue(token, source, "single-quoted-scalar");
          break;
        default:
          setFlowScalarValue(token, source, "scalar");
      }
    }
    function setBlockScalarValue(token, source) {
      const he = source.indexOf("\n");
      const head = source.substring(0, he);
      const body = source.substring(he + 1) + "\n";
      if (token.type === "block-scalar") {
        const header = token.props[0];
        if (header.type !== "block-scalar-header")
          throw new Error("Invalid block scalar header");
        header.source = head;
        token.source = body;
      } else {
        const { offset } = token;
        const indent = "indent" in token ? token.indent : -1;
        const props = [
          { type: "block-scalar-header", offset, indent, source: head }
        ];
        if (!addEndtoBlockProps(props, "end" in token ? token.end : void 0))
          props.push({ type: "newline", offset: -1, indent, source: "\n" });
        for (const key of Object.keys(token))
          if (key !== "type" && key !== "offset")
            delete token[key];
        Object.assign(token, { type: "block-scalar", indent, props, source: body });
      }
    }
    function addEndtoBlockProps(props, end) {
      if (end)
        for (const st of end)
          switch (st.type) {
            case "space":
            case "comment":
              props.push(st);
              break;
            case "newline":
              props.push(st);
              return true;
          }
      return false;
    }
    function setFlowScalarValue(token, source, type) {
      switch (token.type) {
        case "scalar":
        case "double-quoted-scalar":
        case "single-quoted-scalar":
          token.type = type;
          token.source = source;
          break;
        case "block-scalar": {
          const end = token.props.slice(1);
          let oa = source.length;
          if (token.props[0].type === "block-scalar-header")
            oa -= token.props[0].source.length;
          for (const tok of end)
            tok.offset += oa;
          delete token.props;
          Object.assign(token, { type, source, end });
          break;
        }
        case "block-map":
        case "block-seq": {
          const offset = token.offset + source.length;
          const nl = { type: "newline", offset, indent: token.indent, source: "\n" };
          delete token.items;
          Object.assign(token, { type, source, end: [nl] });
          break;
        }
        default: {
          const indent = "indent" in token ? token.indent : -1;
          const end = "end" in token && Array.isArray(token.end) ? token.end.filter((st) => st.type === "space" || st.type === "comment" || st.type === "newline") : [];
          for (const key of Object.keys(token))
            if (key !== "type" && key !== "offset")
              delete token[key];
          Object.assign(token, { type, indent, source, end });
        }
      }
    }
    exports.createScalarToken = createScalarToken;
    exports.resolveAsScalar = resolveAsScalar;
    exports.setScalarValue = setScalarValue;
  }
});

// node_modules/yaml/dist/parse/cst-stringify.js
var require_cst_stringify = __commonJS({
  "node_modules/yaml/dist/parse/cst-stringify.js"(exports) {
    "use strict";
    var stringify = (cst) => "type" in cst ? stringifyToken(cst) : stringifyItem(cst);
    function stringifyToken(token) {
      switch (token.type) {
        case "block-scalar": {
          let res = "";
          for (const tok of token.props)
            res += stringifyToken(tok);
          return res + token.source;
        }
        case "block-map":
        case "block-seq": {
          let res = "";
          for (const item of token.items)
            res += stringifyItem(item);
          return res;
        }
        case "flow-collection": {
          let res = token.start.source;
          for (const item of token.items)
            res += stringifyItem(item);
          for (const st of token.end)
            res += st.source;
          return res;
        }
        case "document": {
          let res = stringifyItem(token);
          if (token.end)
            for (const st of token.end)
              res += st.source;
          return res;
        }
        default: {
          let res = token.source;
          if ("end" in token && token.end)
            for (const st of token.end)
              res += st.source;
          return res;
        }
      }
    }
    function stringifyItem({ start, key, sep: sep2, value }) {
      let res = "";
      for (const st of start)
        res += st.source;
      if (key)
        res += stringifyToken(key);
      if (sep2)
        for (const st of sep2)
          res += st.source;
      if (value)
        res += stringifyToken(value);
      return res;
    }
    exports.stringify = stringify;
  }
});

// node_modules/yaml/dist/parse/cst-visit.js
var require_cst_visit = __commonJS({
  "node_modules/yaml/dist/parse/cst-visit.js"(exports) {
    "use strict";
    var BREAK = Symbol("break visit");
    var SKIP = Symbol("skip children");
    var REMOVE = Symbol("remove item");
    function visit(cst, visitor) {
      if ("type" in cst && cst.type === "document")
        cst = { start: cst.start, value: cst.value };
      _visit(Object.freeze([]), cst, visitor);
    }
    visit.BREAK = BREAK;
    visit.SKIP = SKIP;
    visit.REMOVE = REMOVE;
    visit.itemAtPath = (cst, path) => {
      let item = cst;
      for (const [field, index] of path) {
        const tok = item?.[field];
        if (tok && "items" in tok) {
          item = tok.items[index];
        } else
          return void 0;
      }
      return item;
    };
    visit.parentCollection = (cst, path) => {
      const parent = visit.itemAtPath(cst, path.slice(0, -1));
      const field = path[path.length - 1][0];
      const coll = parent?.[field];
      if (coll && "items" in coll)
        return coll;
      throw new Error("Parent collection not found");
    };
    function _visit(path, item, visitor) {
      let ctrl = visitor(item, path);
      if (typeof ctrl === "symbol")
        return ctrl;
      for (const field of ["key", "value"]) {
        const token = item[field];
        if (token && "items" in token) {
          for (let i = 0; i < token.items.length; ++i) {
            const ci = _visit(Object.freeze(path.concat([[field, i]])), token.items[i], visitor);
            if (typeof ci === "number")
              i = ci - 1;
            else if (ci === BREAK)
              return BREAK;
            else if (ci === REMOVE) {
              token.items.splice(i, 1);
              i -= 1;
            }
          }
          if (typeof ctrl === "function" && field === "key")
            ctrl = ctrl(item, path);
        }
      }
      return typeof ctrl === "function" ? ctrl(item, path) : ctrl;
    }
    exports.visit = visit;
  }
});

// node_modules/yaml/dist/parse/cst.js
var require_cst = __commonJS({
  "node_modules/yaml/dist/parse/cst.js"(exports) {
    "use strict";
    var cstScalar = require_cst_scalar();
    var cstStringify = require_cst_stringify();
    var cstVisit = require_cst_visit();
    var BOM = "\uFEFF";
    var DOCUMENT = "";
    var FLOW_END = "";
    var SCALAR = "";
    var isCollection = (token) => !!token && "items" in token;
    var isScalar = (token) => !!token && (token.type === "scalar" || token.type === "single-quoted-scalar" || token.type === "double-quoted-scalar" || token.type === "block-scalar");
    function prettyToken(token) {
      switch (token) {
        case BOM:
          return "<BOM>";
        case DOCUMENT:
          return "<DOC>";
        case FLOW_END:
          return "<FLOW_END>";
        case SCALAR:
          return "<SCALAR>";
        default:
          return JSON.stringify(token);
      }
    }
    function tokenType(source) {
      switch (source) {
        case BOM:
          return "byte-order-mark";
        case DOCUMENT:
          return "doc-mode";
        case FLOW_END:
          return "flow-error-end";
        case SCALAR:
          return "scalar";
        case "---":
          return "doc-start";
        case "...":
          return "doc-end";
        case "":
        case "\n":
        case "\r\n":
          return "newline";
        case "-":
          return "seq-item-ind";
        case "?":
          return "explicit-key-ind";
        case ":":
          return "map-value-ind";
        case "{":
          return "flow-map-start";
        case "}":
          return "flow-map-end";
        case "[":
          return "flow-seq-start";
        case "]":
          return "flow-seq-end";
        case ",":
          return "comma";
      }
      switch (source[0]) {
        case " ":
        case "	":
          return "space";
        case "#":
          return "comment";
        case "%":
          return "directive-line";
        case "*":
          return "alias";
        case "&":
          return "anchor";
        case "!":
          return "tag";
        case "'":
          return "single-quoted-scalar";
        case '"':
          return "double-quoted-scalar";
        case "|":
        case ">":
          return "block-scalar-header";
      }
      return null;
    }
    exports.createScalarToken = cstScalar.createScalarToken;
    exports.resolveAsScalar = cstScalar.resolveAsScalar;
    exports.setScalarValue = cstScalar.setScalarValue;
    exports.stringify = cstStringify.stringify;
    exports.visit = cstVisit.visit;
    exports.BOM = BOM;
    exports.DOCUMENT = DOCUMENT;
    exports.FLOW_END = FLOW_END;
    exports.SCALAR = SCALAR;
    exports.isCollection = isCollection;
    exports.isScalar = isScalar;
    exports.prettyToken = prettyToken;
    exports.tokenType = tokenType;
  }
});

// node_modules/yaml/dist/parse/lexer.js
var require_lexer = __commonJS({
  "node_modules/yaml/dist/parse/lexer.js"(exports) {
    "use strict";
    var cst = require_cst();
    function isEmpty(ch) {
      switch (ch) {
        case void 0:
        case " ":
        case "\n":
        case "\r":
        case "	":
          return true;
        default:
          return false;
      }
    }
    var hexDigits = new Set("0123456789ABCDEFabcdef");
    var tagChars = new Set("0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-#;/?:@&=+$_.!~*'()");
    var flowIndicatorChars = new Set(",[]{}");
    var invalidAnchorChars = new Set(" ,[]{}\n\r	");
    var isNotAnchorChar = (ch) => !ch || invalidAnchorChars.has(ch);
    var Lexer = class {
      constructor() {
        this.atEnd = false;
        this.blockScalarIndent = -1;
        this.blockScalarKeep = false;
        this.buffer = "";
        this.flowKey = false;
        this.flowLevel = 0;
        this.indentNext = 0;
        this.indentValue = 0;
        this.lineEndPos = null;
        this.next = null;
        this.pos = 0;
      }
      /**
       * Generate YAML tokens from the `source` string. If `incomplete`,
       * a part of the last line may be left as a buffer for the next call.
       *
       * @returns A generator of lexical tokens
       */
      *lex(source, incomplete = false) {
        if (source) {
          if (typeof source !== "string")
            throw TypeError("source is not a string");
          this.buffer = this.buffer ? this.buffer + source : source;
          this.lineEndPos = null;
        }
        this.atEnd = !incomplete;
        let next = this.next ?? "stream";
        while (next && (incomplete || this.hasChars(1)))
          next = yield* this.parseNext(next);
      }
      atLineEnd() {
        let i = this.pos;
        let ch = this.buffer[i];
        while (ch === " " || ch === "	")
          ch = this.buffer[++i];
        if (!ch || ch === "#" || ch === "\n")
          return true;
        if (ch === "\r")
          return this.buffer[i + 1] === "\n";
        return false;
      }
      charAt(n) {
        return this.buffer[this.pos + n];
      }
      continueScalar(offset) {
        let ch = this.buffer[offset];
        if (this.indentNext > 0) {
          let indent = 0;
          while (ch === " ")
            ch = this.buffer[++indent + offset];
          if (ch === "\r") {
            const next = this.buffer[indent + offset + 1];
            if (next === "\n" || !next && !this.atEnd)
              return offset + indent + 1;
          }
          return ch === "\n" || indent >= this.indentNext || !ch && !this.atEnd ? offset + indent : -1;
        }
        if (ch === "-" || ch === ".") {
          const dt = this.buffer.substr(offset, 3);
          if ((dt === "---" || dt === "...") && isEmpty(this.buffer[offset + 3]))
            return -1;
        }
        return offset;
      }
      getLine() {
        let end = this.lineEndPos;
        if (typeof end !== "number" || end !== -1 && end < this.pos) {
          end = this.buffer.indexOf("\n", this.pos);
          this.lineEndPos = end;
        }
        if (end === -1)
          return this.atEnd ? this.buffer.substring(this.pos) : null;
        if (this.buffer[end - 1] === "\r")
          end -= 1;
        return this.buffer.substring(this.pos, end);
      }
      hasChars(n) {
        return this.pos + n <= this.buffer.length;
      }
      setNext(state) {
        this.buffer = this.buffer.substring(this.pos);
        this.pos = 0;
        this.lineEndPos = null;
        this.next = state;
        return null;
      }
      peek(n) {
        return this.buffer.substr(this.pos, n);
      }
      *parseNext(next) {
        switch (next) {
          case "stream":
            return yield* this.parseStream();
          case "line-start":
            return yield* this.parseLineStart();
          case "block-start":
            return yield* this.parseBlockStart();
          case "doc":
            return yield* this.parseDocument();
          case "flow":
            return yield* this.parseFlowCollection();
          case "quoted-scalar":
            return yield* this.parseQuotedScalar();
          case "block-scalar":
            return yield* this.parseBlockScalar();
          case "plain-scalar":
            return yield* this.parsePlainScalar();
        }
      }
      *parseStream() {
        let line = this.getLine();
        if (line === null)
          return this.setNext("stream");
        if (line[0] === cst.BOM) {
          yield* this.pushCount(1);
          line = line.substring(1);
        }
        if (line[0] === "%") {
          let dirEnd = line.length;
          let cs = line.indexOf("#");
          while (cs !== -1) {
            const ch = line[cs - 1];
            if (ch === " " || ch === "	") {
              dirEnd = cs - 1;
              break;
            } else {
              cs = line.indexOf("#", cs + 1);
            }
          }
          while (true) {
            const ch = line[dirEnd - 1];
            if (ch === " " || ch === "	")
              dirEnd -= 1;
            else
              break;
          }
          const n = (yield* this.pushCount(dirEnd)) + (yield* this.pushSpaces(true));
          yield* this.pushCount(line.length - n);
          this.pushNewline();
          return "stream";
        }
        if (this.atLineEnd()) {
          const sp = yield* this.pushSpaces(true);
          yield* this.pushCount(line.length - sp);
          yield* this.pushNewline();
          return "stream";
        }
        yield cst.DOCUMENT;
        return yield* this.parseLineStart();
      }
      *parseLineStart() {
        const ch = this.charAt(0);
        if (!ch && !this.atEnd)
          return this.setNext("line-start");
        if (ch === "-" || ch === ".") {
          if (!this.atEnd && !this.hasChars(4))
            return this.setNext("line-start");
          const s = this.peek(3);
          if ((s === "---" || s === "...") && isEmpty(this.charAt(3))) {
            yield* this.pushCount(3);
            this.indentValue = 0;
            this.indentNext = 0;
            return s === "---" ? "doc" : "stream";
          }
        }
        this.indentValue = yield* this.pushSpaces(false);
        if (this.indentNext > this.indentValue && !isEmpty(this.charAt(1)))
          this.indentNext = this.indentValue;
        return yield* this.parseBlockStart();
      }
      *parseBlockStart() {
        const [ch0, ch1] = this.peek(2);
        if (!ch1 && !this.atEnd)
          return this.setNext("block-start");
        if ((ch0 === "-" || ch0 === "?" || ch0 === ":") && isEmpty(ch1)) {
          const n = (yield* this.pushCount(1)) + (yield* this.pushSpaces(true));
          this.indentNext = this.indentValue + 1;
          this.indentValue += n;
          return yield* this.parseBlockStart();
        }
        return "doc";
      }
      *parseDocument() {
        yield* this.pushSpaces(true);
        const line = this.getLine();
        if (line === null)
          return this.setNext("doc");
        let n = yield* this.pushIndicators();
        switch (line[n]) {
          case "#":
            yield* this.pushCount(line.length - n);
          // fallthrough
          case void 0:
            yield* this.pushNewline();
            return yield* this.parseLineStart();
          case "{":
          case "[":
            yield* this.pushCount(1);
            this.flowKey = false;
            this.flowLevel = 1;
            return "flow";
          case "}":
          case "]":
            yield* this.pushCount(1);
            return "doc";
          case "*":
            yield* this.pushUntil(isNotAnchorChar);
            return "doc";
          case '"':
          case "'":
            return yield* this.parseQuotedScalar();
          case "|":
          case ">":
            n += yield* this.parseBlockScalarHeader();
            n += yield* this.pushSpaces(true);
            yield* this.pushCount(line.length - n);
            yield* this.pushNewline();
            return yield* this.parseBlockScalar();
          default:
            return yield* this.parsePlainScalar();
        }
      }
      *parseFlowCollection() {
        let nl, sp;
        let indent = -1;
        do {
          nl = yield* this.pushNewline();
          if (nl > 0) {
            sp = yield* this.pushSpaces(false);
            this.indentValue = indent = sp;
          } else {
            sp = 0;
          }
          sp += yield* this.pushSpaces(true);
        } while (nl + sp > 0);
        const line = this.getLine();
        if (line === null)
          return this.setNext("flow");
        if (indent !== -1 && indent < this.indentNext && line[0] !== "#" || indent === 0 && (line.startsWith("---") || line.startsWith("...")) && isEmpty(line[3])) {
          const atFlowEndMarker = indent === this.indentNext - 1 && this.flowLevel === 1 && (line[0] === "]" || line[0] === "}");
          if (!atFlowEndMarker) {
            this.flowLevel = 0;
            yield cst.FLOW_END;
            return yield* this.parseLineStart();
          }
        }
        let n = 0;
        while (line[n] === ",") {
          n += yield* this.pushCount(1);
          n += yield* this.pushSpaces(true);
          this.flowKey = false;
        }
        n += yield* this.pushIndicators();
        switch (line[n]) {
          case void 0:
            return "flow";
          case "#":
            yield* this.pushCount(line.length - n);
            return "flow";
          case "{":
          case "[":
            yield* this.pushCount(1);
            this.flowKey = false;
            this.flowLevel += 1;
            return "flow";
          case "}":
          case "]":
            yield* this.pushCount(1);
            this.flowKey = true;
            this.flowLevel -= 1;
            return this.flowLevel ? "flow" : "doc";
          case "*":
            yield* this.pushUntil(isNotAnchorChar);
            return "flow";
          case '"':
          case "'":
            this.flowKey = true;
            return yield* this.parseQuotedScalar();
          case ":": {
            const next = this.charAt(1);
            if (this.flowKey || isEmpty(next) || next === ",") {
              this.flowKey = false;
              yield* this.pushCount(1);
              yield* this.pushSpaces(true);
              return "flow";
            }
          }
          // fallthrough
          default:
            this.flowKey = false;
            return yield* this.parsePlainScalar();
        }
      }
      *parseQuotedScalar() {
        const quote = this.charAt(0);
        let end = this.buffer.indexOf(quote, this.pos + 1);
        if (quote === "'") {
          while (end !== -1 && this.buffer[end + 1] === "'")
            end = this.buffer.indexOf("'", end + 2);
        } else {
          while (end !== -1) {
            let n = 0;
            while (this.buffer[end - 1 - n] === "\\")
              n += 1;
            if (n % 2 === 0)
              break;
            end = this.buffer.indexOf('"', end + 1);
          }
        }
        const qb = this.buffer.substring(0, end);
        let nl = qb.indexOf("\n", this.pos);
        if (nl !== -1) {
          while (nl !== -1) {
            const cs = this.continueScalar(nl + 1);
            if (cs === -1)
              break;
            nl = qb.indexOf("\n", cs);
          }
          if (nl !== -1) {
            end = nl - (qb[nl - 1] === "\r" ? 2 : 1);
          }
        }
        if (end === -1) {
          if (!this.atEnd)
            return this.setNext("quoted-scalar");
          end = this.buffer.length;
        }
        yield* this.pushToIndex(end + 1, false);
        return this.flowLevel ? "flow" : "doc";
      }
      *parseBlockScalarHeader() {
        this.blockScalarIndent = -1;
        this.blockScalarKeep = false;
        let i = this.pos;
        while (true) {
          const ch = this.buffer[++i];
          if (ch === "+")
            this.blockScalarKeep = true;
          else if (ch > "0" && ch <= "9")
            this.blockScalarIndent = Number(ch) - 1;
          else if (ch !== "-")
            break;
        }
        return yield* this.pushUntil((ch) => isEmpty(ch) || ch === "#");
      }
      *parseBlockScalar() {
        let nl = this.pos - 1;
        let indent = 0;
        let ch;
        loop: for (let i2 = this.pos; ch = this.buffer[i2]; ++i2) {
          switch (ch) {
            case " ":
              indent += 1;
              break;
            case "\n":
              nl = i2;
              indent = 0;
              break;
            case "\r": {
              const next = this.buffer[i2 + 1];
              if (!next && !this.atEnd)
                return this.setNext("block-scalar");
              if (next === "\n")
                break;
            }
            // fallthrough
            default:
              break loop;
          }
        }
        if (!ch && !this.atEnd)
          return this.setNext("block-scalar");
        if (indent >= this.indentNext) {
          if (this.blockScalarIndent === -1)
            this.indentNext = indent;
          else {
            this.indentNext = this.blockScalarIndent + (this.indentNext === 0 ? 1 : this.indentNext);
          }
          do {
            const cs = this.continueScalar(nl + 1);
            if (cs === -1)
              break;
            nl = this.buffer.indexOf("\n", cs);
          } while (nl !== -1);
          if (nl === -1) {
            if (!this.atEnd)
              return this.setNext("block-scalar");
            nl = this.buffer.length;
          }
        }
        let i = nl + 1;
        ch = this.buffer[i];
        while (ch === " ")
          ch = this.buffer[++i];
        if (ch === "	") {
          while (ch === "	" || ch === " " || ch === "\r" || ch === "\n")
            ch = this.buffer[++i];
          nl = i - 1;
        } else if (!this.blockScalarKeep) {
          do {
            let i2 = nl - 1;
            let ch2 = this.buffer[i2];
            if (ch2 === "\r")
              ch2 = this.buffer[--i2];
            const lastChar = i2;
            while (ch2 === " ")
              ch2 = this.buffer[--i2];
            if (ch2 === "\n" && i2 >= this.pos && i2 + 1 + indent > lastChar)
              nl = i2;
            else
              break;
          } while (true);
        }
        yield cst.SCALAR;
        yield* this.pushToIndex(nl + 1, true);
        return yield* this.parseLineStart();
      }
      *parsePlainScalar() {
        const inFlow = this.flowLevel > 0;
        let end = this.pos - 1;
        let i = this.pos - 1;
        let ch;
        while (ch = this.buffer[++i]) {
          if (ch === ":") {
            const next = this.buffer[i + 1];
            if (isEmpty(next) || inFlow && flowIndicatorChars.has(next))
              break;
            end = i;
          } else if (isEmpty(ch)) {
            let next = this.buffer[i + 1];
            if (ch === "\r") {
              if (next === "\n") {
                i += 1;
                ch = "\n";
                next = this.buffer[i + 1];
              } else
                end = i;
            }
            if (next === "#" || inFlow && flowIndicatorChars.has(next))
              break;
            if (ch === "\n") {
              const cs = this.continueScalar(i + 1);
              if (cs === -1)
                break;
              i = Math.max(i, cs - 2);
            }
          } else {
            if (inFlow && flowIndicatorChars.has(ch))
              break;
            end = i;
          }
        }
        if (!ch && !this.atEnd)
          return this.setNext("plain-scalar");
        yield cst.SCALAR;
        yield* this.pushToIndex(end + 1, true);
        return inFlow ? "flow" : "doc";
      }
      *pushCount(n) {
        if (n > 0) {
          yield this.buffer.substr(this.pos, n);
          this.pos += n;
          return n;
        }
        return 0;
      }
      *pushToIndex(i, allowEmpty) {
        const s = this.buffer.slice(this.pos, i);
        if (s) {
          yield s;
          this.pos += s.length;
          return s.length;
        } else if (allowEmpty)
          yield "";
        return 0;
      }
      *pushIndicators() {
        switch (this.charAt(0)) {
          case "!":
            return (yield* this.pushTag()) + (yield* this.pushSpaces(true)) + (yield* this.pushIndicators());
          case "&":
            return (yield* this.pushUntil(isNotAnchorChar)) + (yield* this.pushSpaces(true)) + (yield* this.pushIndicators());
          case "-":
          // this is an error
          case "?":
          // this is an error outside flow collections
          case ":": {
            const inFlow = this.flowLevel > 0;
            const ch1 = this.charAt(1);
            if (isEmpty(ch1) || inFlow && flowIndicatorChars.has(ch1)) {
              if (!inFlow)
                this.indentNext = this.indentValue + 1;
              else if (this.flowKey)
                this.flowKey = false;
              return (yield* this.pushCount(1)) + (yield* this.pushSpaces(true)) + (yield* this.pushIndicators());
            }
          }
        }
        return 0;
      }
      *pushTag() {
        if (this.charAt(1) === "<") {
          let i = this.pos + 2;
          let ch = this.buffer[i];
          while (!isEmpty(ch) && ch !== ">")
            ch = this.buffer[++i];
          return yield* this.pushToIndex(ch === ">" ? i + 1 : i, false);
        } else {
          let i = this.pos + 1;
          let ch = this.buffer[i];
          while (ch) {
            if (tagChars.has(ch))
              ch = this.buffer[++i];
            else if (ch === "%" && hexDigits.has(this.buffer[i + 1]) && hexDigits.has(this.buffer[i + 2])) {
              ch = this.buffer[i += 3];
            } else
              break;
          }
          return yield* this.pushToIndex(i, false);
        }
      }
      *pushNewline() {
        const ch = this.buffer[this.pos];
        if (ch === "\n")
          return yield* this.pushCount(1);
        else if (ch === "\r" && this.charAt(1) === "\n")
          return yield* this.pushCount(2);
        else
          return 0;
      }
      *pushSpaces(allowTabs) {
        let i = this.pos - 1;
        let ch;
        do {
          ch = this.buffer[++i];
        } while (ch === " " || allowTabs && ch === "	");
        const n = i - this.pos;
        if (n > 0) {
          yield this.buffer.substr(this.pos, n);
          this.pos = i;
        }
        return n;
      }
      *pushUntil(test) {
        let i = this.pos;
        let ch = this.buffer[i];
        while (!test(ch))
          ch = this.buffer[++i];
        return yield* this.pushToIndex(i, false);
      }
    };
    exports.Lexer = Lexer;
  }
});

// node_modules/yaml/dist/parse/line-counter.js
var require_line_counter = __commonJS({
  "node_modules/yaml/dist/parse/line-counter.js"(exports) {
    "use strict";
    var LineCounter = class {
      constructor() {
        this.lineStarts = [];
        this.addNewLine = (offset) => this.lineStarts.push(offset);
        this.linePos = (offset) => {
          let low = 0;
          let high = this.lineStarts.length;
          while (low < high) {
            const mid = low + high >> 1;
            if (this.lineStarts[mid] < offset)
              low = mid + 1;
            else
              high = mid;
          }
          if (this.lineStarts[low] === offset)
            return { line: low + 1, col: 1 };
          if (low === 0)
            return { line: 0, col: offset };
          const start = this.lineStarts[low - 1];
          return { line: low, col: offset - start + 1 };
        };
      }
    };
    exports.LineCounter = LineCounter;
  }
});

// node_modules/yaml/dist/parse/parser.js
var require_parser = __commonJS({
  "node_modules/yaml/dist/parse/parser.js"(exports) {
    "use strict";
    var node_process = __require("process");
    var cst = require_cst();
    var lexer = require_lexer();
    function includesToken(list, type) {
      for (let i = 0; i < list.length; ++i)
        if (list[i].type === type)
          return true;
      return false;
    }
    function findNonEmptyIndex(list) {
      for (let i = 0; i < list.length; ++i) {
        switch (list[i].type) {
          case "space":
          case "comment":
          case "newline":
            break;
          default:
            return i;
        }
      }
      return -1;
    }
    function isFlowToken(token) {
      switch (token?.type) {
        case "alias":
        case "scalar":
        case "single-quoted-scalar":
        case "double-quoted-scalar":
        case "flow-collection":
          return true;
        default:
          return false;
      }
    }
    function getPrevProps(parent) {
      switch (parent.type) {
        case "document":
          return parent.start;
        case "block-map": {
          const it = parent.items[parent.items.length - 1];
          return it.sep ?? it.start;
        }
        case "block-seq":
          return parent.items[parent.items.length - 1].start;
        /* istanbul ignore next should not happen */
        default:
          return [];
      }
    }
    function getFirstKeyStartProps(prev) {
      if (prev.length === 0)
        return [];
      let i = prev.length;
      loop: while (--i >= 0) {
        switch (prev[i].type) {
          case "doc-start":
          case "explicit-key-ind":
          case "map-value-ind":
          case "seq-item-ind":
          case "newline":
            break loop;
        }
      }
      while (prev[++i]?.type === "space") {
      }
      return prev.splice(i, prev.length);
    }
    function fixFlowSeqItems(fc) {
      if (fc.start.type === "flow-seq-start") {
        for (const it of fc.items) {
          if (it.sep && !it.value && !includesToken(it.start, "explicit-key-ind") && !includesToken(it.sep, "map-value-ind")) {
            if (it.key)
              it.value = it.key;
            delete it.key;
            if (isFlowToken(it.value)) {
              if (it.value.end)
                Array.prototype.push.apply(it.value.end, it.sep);
              else
                it.value.end = it.sep;
            } else
              Array.prototype.push.apply(it.start, it.sep);
            delete it.sep;
          }
        }
      }
    }
    var Parser = class {
      /**
       * @param onNewLine - If defined, called separately with the start position of
       *   each new line (in `parse()`, including the start of input).
       */
      constructor(onNewLine) {
        this.atNewLine = true;
        this.atScalar = false;
        this.indent = 0;
        this.offset = 0;
        this.onKeyLine = false;
        this.stack = [];
        this.source = "";
        this.type = "";
        this.lexer = new lexer.Lexer();
        this.onNewLine = onNewLine;
      }
      /**
       * Parse `source` as a YAML stream.
       * If `incomplete`, a part of the last line may be left as a buffer for the next call.
       *
       * Errors are not thrown, but yielded as `{ type: 'error', message }` tokens.
       *
       * @returns A generator of tokens representing each directive, document, and other structure.
       */
      *parse(source, incomplete = false) {
        if (this.onNewLine && this.offset === 0)
          this.onNewLine(0);
        for (const lexeme of this.lexer.lex(source, incomplete))
          yield* this.next(lexeme);
        if (!incomplete)
          yield* this.end();
      }
      /**
       * Advance the parser by the `source` of one lexical token.
       */
      *next(source) {
        this.source = source;
        if (node_process.env.LOG_TOKENS)
          console.log("|", cst.prettyToken(source));
        if (this.atScalar) {
          this.atScalar = false;
          yield* this.step();
          this.offset += source.length;
          return;
        }
        const type = cst.tokenType(source);
        if (!type) {
          const message = `Not a YAML token: ${source}`;
          yield* this.pop({ type: "error", offset: this.offset, message, source });
          this.offset += source.length;
        } else if (type === "scalar") {
          this.atNewLine = false;
          this.atScalar = true;
          this.type = "scalar";
        } else {
          this.type = type;
          yield* this.step();
          switch (type) {
            case "newline":
              this.atNewLine = true;
              this.indent = 0;
              if (this.onNewLine)
                this.onNewLine(this.offset + source.length);
              break;
            case "space":
              if (this.atNewLine && source[0] === " ")
                this.indent += source.length;
              break;
            case "explicit-key-ind":
            case "map-value-ind":
            case "seq-item-ind":
              if (this.atNewLine)
                this.indent += source.length;
              break;
            case "doc-mode":
            case "flow-error-end":
              return;
            default:
              this.atNewLine = false;
          }
          this.offset += source.length;
        }
      }
      /** Call at end of input to push out any remaining constructions */
      *end() {
        while (this.stack.length > 0)
          yield* this.pop();
      }
      get sourceToken() {
        const st = {
          type: this.type,
          offset: this.offset,
          indent: this.indent,
          source: this.source
        };
        return st;
      }
      *step() {
        const top = this.peek(1);
        if (this.type === "doc-end" && top?.type !== "doc-end") {
          while (this.stack.length > 0)
            yield* this.pop();
          this.stack.push({
            type: "doc-end",
            offset: this.offset,
            source: this.source
          });
          return;
        }
        if (!top)
          return yield* this.stream();
        switch (top.type) {
          case "document":
            return yield* this.document(top);
          case "alias":
          case "scalar":
          case "single-quoted-scalar":
          case "double-quoted-scalar":
            return yield* this.scalar(top);
          case "block-scalar":
            return yield* this.blockScalar(top);
          case "block-map":
            return yield* this.blockMap(top);
          case "block-seq":
            return yield* this.blockSequence(top);
          case "flow-collection":
            return yield* this.flowCollection(top);
          case "doc-end":
            return yield* this.documentEnd(top);
        }
        yield* this.pop();
      }
      peek(n) {
        return this.stack[this.stack.length - n];
      }
      *pop(error) {
        const token = error ?? this.stack.pop();
        if (!token) {
          const message = "Tried to pop an empty stack";
          yield { type: "error", offset: this.offset, source: "", message };
        } else if (this.stack.length === 0) {
          yield token;
        } else {
          const top = this.peek(1);
          if (token.type === "block-scalar") {
            token.indent = "indent" in top ? top.indent : 0;
          } else if (token.type === "flow-collection" && top.type === "document") {
            token.indent = 0;
          }
          if (token.type === "flow-collection")
            fixFlowSeqItems(token);
          switch (top.type) {
            case "document":
              top.value = token;
              break;
            case "block-scalar":
              top.props.push(token);
              break;
            case "block-map": {
              const it = top.items[top.items.length - 1];
              if (it.value) {
                top.items.push({ start: [], key: token, sep: [] });
                this.onKeyLine = true;
                return;
              } else if (it.sep) {
                it.value = token;
              } else {
                Object.assign(it, { key: token, sep: [] });
                this.onKeyLine = !it.explicitKey;
                return;
              }
              break;
            }
            case "block-seq": {
              const it = top.items[top.items.length - 1];
              if (it.value)
                top.items.push({ start: [], value: token });
              else
                it.value = token;
              break;
            }
            case "flow-collection": {
              const it = top.items[top.items.length - 1];
              if (!it || it.value)
                top.items.push({ start: [], key: token, sep: [] });
              else if (it.sep)
                it.value = token;
              else
                Object.assign(it, { key: token, sep: [] });
              return;
            }
            /* istanbul ignore next should not happen */
            default:
              yield* this.pop();
              yield* this.pop(token);
          }
          if ((top.type === "document" || top.type === "block-map" || top.type === "block-seq") && (token.type === "block-map" || token.type === "block-seq")) {
            const last = token.items[token.items.length - 1];
            if (last && !last.sep && !last.value && last.start.length > 0 && findNonEmptyIndex(last.start) === -1 && (token.indent === 0 || last.start.every((st) => st.type !== "comment" || st.indent < token.indent))) {
              if (top.type === "document")
                top.end = last.start;
              else
                top.items.push({ start: last.start });
              token.items.splice(-1, 1);
            }
          }
        }
      }
      *stream() {
        switch (this.type) {
          case "directive-line":
            yield { type: "directive", offset: this.offset, source: this.source };
            return;
          case "byte-order-mark":
          case "space":
          case "comment":
          case "newline":
            yield this.sourceToken;
            return;
          case "doc-mode":
          case "doc-start": {
            const doc = {
              type: "document",
              offset: this.offset,
              start: []
            };
            if (this.type === "doc-start")
              doc.start.push(this.sourceToken);
            this.stack.push(doc);
            return;
          }
        }
        yield {
          type: "error",
          offset: this.offset,
          message: `Unexpected ${this.type} token in YAML stream`,
          source: this.source
        };
      }
      *document(doc) {
        if (doc.value)
          return yield* this.lineEnd(doc);
        switch (this.type) {
          case "doc-start": {
            if (findNonEmptyIndex(doc.start) !== -1) {
              yield* this.pop();
              yield* this.step();
            } else
              doc.start.push(this.sourceToken);
            return;
          }
          case "anchor":
          case "tag":
          case "space":
          case "comment":
          case "newline":
            doc.start.push(this.sourceToken);
            return;
        }
        const bv = this.startBlockValue(doc);
        if (bv)
          this.stack.push(bv);
        else {
          yield {
            type: "error",
            offset: this.offset,
            message: `Unexpected ${this.type} token in YAML document`,
            source: this.source
          };
        }
      }
      *scalar(scalar) {
        if (this.type === "map-value-ind") {
          const prev = getPrevProps(this.peek(2));
          const start = getFirstKeyStartProps(prev);
          let sep2;
          if (scalar.end) {
            sep2 = scalar.end;
            sep2.push(this.sourceToken);
            delete scalar.end;
          } else
            sep2 = [this.sourceToken];
          const map = {
            type: "block-map",
            offset: scalar.offset,
            indent: scalar.indent,
            items: [{ start, key: scalar, sep: sep2 }]
          };
          this.onKeyLine = true;
          this.stack[this.stack.length - 1] = map;
        } else
          yield* this.lineEnd(scalar);
      }
      *blockScalar(scalar) {
        switch (this.type) {
          case "space":
          case "comment":
          case "newline":
            scalar.props.push(this.sourceToken);
            return;
          case "scalar":
            scalar.source = this.source;
            this.atNewLine = true;
            this.indent = 0;
            if (this.onNewLine) {
              let nl = this.source.indexOf("\n") + 1;
              while (nl !== 0) {
                this.onNewLine(this.offset + nl);
                nl = this.source.indexOf("\n", nl) + 1;
              }
            }
            yield* this.pop();
            break;
          /* istanbul ignore next should not happen */
          default:
            yield* this.pop();
            yield* this.step();
        }
      }
      *blockMap(map) {
        const it = map.items[map.items.length - 1];
        switch (this.type) {
          case "newline":
            this.onKeyLine = false;
            if (it.value) {
              const end = "end" in it.value ? it.value.end : void 0;
              const last = Array.isArray(end) ? end[end.length - 1] : void 0;
              if (last?.type === "comment")
                end?.push(this.sourceToken);
              else
                map.items.push({ start: [this.sourceToken] });
            } else if (it.sep) {
              it.sep.push(this.sourceToken);
            } else {
              it.start.push(this.sourceToken);
            }
            return;
          case "space":
          case "comment":
            if (it.value) {
              map.items.push({ start: [this.sourceToken] });
            } else if (it.sep) {
              it.sep.push(this.sourceToken);
            } else {
              if (this.atIndentedComment(it.start, map.indent)) {
                const prev = map.items[map.items.length - 2];
                const end = prev?.value?.end;
                if (Array.isArray(end)) {
                  Array.prototype.push.apply(end, it.start);
                  end.push(this.sourceToken);
                  map.items.pop();
                  return;
                }
              }
              it.start.push(this.sourceToken);
            }
            return;
        }
        if (this.indent >= map.indent) {
          const atMapIndent = !this.onKeyLine && this.indent === map.indent;
          const atNextItem = atMapIndent && (it.sep || it.explicitKey) && this.type !== "seq-item-ind";
          let start = [];
          if (atNextItem && it.sep && !it.value) {
            const nl = [];
            for (let i = 0; i < it.sep.length; ++i) {
              const st = it.sep[i];
              switch (st.type) {
                case "newline":
                  nl.push(i);
                  break;
                case "space":
                  break;
                case "comment":
                  if (st.indent > map.indent)
                    nl.length = 0;
                  break;
                default:
                  nl.length = 0;
              }
            }
            if (nl.length >= 2)
              start = it.sep.splice(nl[1]);
          }
          switch (this.type) {
            case "anchor":
            case "tag":
              if (atNextItem || it.value) {
                start.push(this.sourceToken);
                map.items.push({ start });
                this.onKeyLine = true;
              } else if (it.sep) {
                it.sep.push(this.sourceToken);
              } else {
                it.start.push(this.sourceToken);
              }
              return;
            case "explicit-key-ind":
              if (!it.sep && !it.explicitKey) {
                it.start.push(this.sourceToken);
                it.explicitKey = true;
              } else if (atNextItem || it.value) {
                start.push(this.sourceToken);
                map.items.push({ start, explicitKey: true });
              } else {
                this.stack.push({
                  type: "block-map",
                  offset: this.offset,
                  indent: this.indent,
                  items: [{ start: [this.sourceToken], explicitKey: true }]
                });
              }
              this.onKeyLine = true;
              return;
            case "map-value-ind":
              if (it.explicitKey) {
                if (!it.sep) {
                  if (includesToken(it.start, "newline")) {
                    Object.assign(it, { key: null, sep: [this.sourceToken] });
                  } else {
                    const start2 = getFirstKeyStartProps(it.start);
                    this.stack.push({
                      type: "block-map",
                      offset: this.offset,
                      indent: this.indent,
                      items: [{ start: start2, key: null, sep: [this.sourceToken] }]
                    });
                  }
                } else if (it.value) {
                  map.items.push({ start: [], key: null, sep: [this.sourceToken] });
                } else if (includesToken(it.sep, "map-value-ind")) {
                  this.stack.push({
                    type: "block-map",
                    offset: this.offset,
                    indent: this.indent,
                    items: [{ start, key: null, sep: [this.sourceToken] }]
                  });
                } else if (isFlowToken(it.key) && !includesToken(it.sep, "newline")) {
                  const start2 = getFirstKeyStartProps(it.start);
                  const key = it.key;
                  const sep2 = it.sep;
                  sep2.push(this.sourceToken);
                  delete it.key;
                  delete it.sep;
                  this.stack.push({
                    type: "block-map",
                    offset: this.offset,
                    indent: this.indent,
                    items: [{ start: start2, key, sep: sep2 }]
                  });
                } else if (start.length > 0) {
                  it.sep = it.sep.concat(start, this.sourceToken);
                } else {
                  it.sep.push(this.sourceToken);
                }
              } else {
                if (!it.sep) {
                  Object.assign(it, { key: null, sep: [this.sourceToken] });
                } else if (it.value || atNextItem) {
                  map.items.push({ start, key: null, sep: [this.sourceToken] });
                } else if (includesToken(it.sep, "map-value-ind")) {
                  this.stack.push({
                    type: "block-map",
                    offset: this.offset,
                    indent: this.indent,
                    items: [{ start: [], key: null, sep: [this.sourceToken] }]
                  });
                } else {
                  it.sep.push(this.sourceToken);
                }
              }
              this.onKeyLine = true;
              return;
            case "alias":
            case "scalar":
            case "single-quoted-scalar":
            case "double-quoted-scalar": {
              const fs = this.flowScalar(this.type);
              if (atNextItem || it.value) {
                map.items.push({ start, key: fs, sep: [] });
                this.onKeyLine = true;
              } else if (it.sep) {
                this.stack.push(fs);
              } else {
                Object.assign(it, { key: fs, sep: [] });
                this.onKeyLine = true;
              }
              return;
            }
            default: {
              const bv = this.startBlockValue(map);
              if (bv) {
                if (bv.type === "block-seq") {
                  if (!it.explicitKey && it.sep && !includesToken(it.sep, "newline")) {
                    yield* this.pop({
                      type: "error",
                      offset: this.offset,
                      message: "Unexpected block-seq-ind on same line with key",
                      source: this.source
                    });
                    return;
                  }
                } else if (atMapIndent) {
                  map.items.push({ start });
                }
                this.stack.push(bv);
                return;
              }
            }
          }
        }
        yield* this.pop();
        yield* this.step();
      }
      *blockSequence(seq) {
        const it = seq.items[seq.items.length - 1];
        switch (this.type) {
          case "newline":
            if (it.value) {
              const end = "end" in it.value ? it.value.end : void 0;
              const last = Array.isArray(end) ? end[end.length - 1] : void 0;
              if (last?.type === "comment")
                end?.push(this.sourceToken);
              else
                seq.items.push({ start: [this.sourceToken] });
            } else
              it.start.push(this.sourceToken);
            return;
          case "space":
          case "comment":
            if (it.value)
              seq.items.push({ start: [this.sourceToken] });
            else {
              if (this.atIndentedComment(it.start, seq.indent)) {
                const prev = seq.items[seq.items.length - 2];
                const end = prev?.value?.end;
                if (Array.isArray(end)) {
                  Array.prototype.push.apply(end, it.start);
                  end.push(this.sourceToken);
                  seq.items.pop();
                  return;
                }
              }
              it.start.push(this.sourceToken);
            }
            return;
          case "anchor":
          case "tag":
            if (it.value || this.indent <= seq.indent)
              break;
            it.start.push(this.sourceToken);
            return;
          case "seq-item-ind":
            if (this.indent !== seq.indent)
              break;
            if (it.value || includesToken(it.start, "seq-item-ind"))
              seq.items.push({ start: [this.sourceToken] });
            else
              it.start.push(this.sourceToken);
            return;
        }
        if (this.indent > seq.indent) {
          const bv = this.startBlockValue(seq);
          if (bv) {
            this.stack.push(bv);
            return;
          }
        }
        yield* this.pop();
        yield* this.step();
      }
      *flowCollection(fc) {
        const it = fc.items[fc.items.length - 1];
        if (this.type === "flow-error-end") {
          let top;
          do {
            yield* this.pop();
            top = this.peek(1);
          } while (top?.type === "flow-collection");
        } else if (fc.end.length === 0) {
          switch (this.type) {
            case "comma":
            case "explicit-key-ind":
              if (!it || it.sep)
                fc.items.push({ start: [this.sourceToken] });
              else
                it.start.push(this.sourceToken);
              return;
            case "map-value-ind":
              if (!it || it.value)
                fc.items.push({ start: [], key: null, sep: [this.sourceToken] });
              else if (it.sep)
                it.sep.push(this.sourceToken);
              else
                Object.assign(it, { key: null, sep: [this.sourceToken] });
              return;
            case "space":
            case "comment":
            case "newline":
            case "anchor":
            case "tag":
              if (!it || it.value)
                fc.items.push({ start: [this.sourceToken] });
              else if (it.sep)
                it.sep.push(this.sourceToken);
              else
                it.start.push(this.sourceToken);
              return;
            case "alias":
            case "scalar":
            case "single-quoted-scalar":
            case "double-quoted-scalar": {
              const fs = this.flowScalar(this.type);
              if (!it || it.value)
                fc.items.push({ start: [], key: fs, sep: [] });
              else if (it.sep)
                this.stack.push(fs);
              else
                Object.assign(it, { key: fs, sep: [] });
              return;
            }
            case "flow-map-end":
            case "flow-seq-end":
              fc.end.push(this.sourceToken);
              return;
          }
          const bv = this.startBlockValue(fc);
          if (bv)
            this.stack.push(bv);
          else {
            yield* this.pop();
            yield* this.step();
          }
        } else {
          const parent = this.peek(2);
          if (parent.type === "block-map" && (this.type === "map-value-ind" && parent.indent === fc.indent || this.type === "newline" && !parent.items[parent.items.length - 1].sep)) {
            yield* this.pop();
            yield* this.step();
          } else if (this.type === "map-value-ind" && parent.type !== "flow-collection") {
            const prev = getPrevProps(parent);
            const start = getFirstKeyStartProps(prev);
            fixFlowSeqItems(fc);
            const sep2 = fc.end.splice(1, fc.end.length);
            sep2.push(this.sourceToken);
            const map = {
              type: "block-map",
              offset: fc.offset,
              indent: fc.indent,
              items: [{ start, key: fc, sep: sep2 }]
            };
            this.onKeyLine = true;
            this.stack[this.stack.length - 1] = map;
          } else {
            yield* this.lineEnd(fc);
          }
        }
      }
      flowScalar(type) {
        if (this.onNewLine) {
          let nl = this.source.indexOf("\n") + 1;
          while (nl !== 0) {
            this.onNewLine(this.offset + nl);
            nl = this.source.indexOf("\n", nl) + 1;
          }
        }
        return {
          type,
          offset: this.offset,
          indent: this.indent,
          source: this.source
        };
      }
      startBlockValue(parent) {
        switch (this.type) {
          case "alias":
          case "scalar":
          case "single-quoted-scalar":
          case "double-quoted-scalar":
            return this.flowScalar(this.type);
          case "block-scalar-header":
            return {
              type: "block-scalar",
              offset: this.offset,
              indent: this.indent,
              props: [this.sourceToken],
              source: ""
            };
          case "flow-map-start":
          case "flow-seq-start":
            return {
              type: "flow-collection",
              offset: this.offset,
              indent: this.indent,
              start: this.sourceToken,
              items: [],
              end: []
            };
          case "seq-item-ind":
            return {
              type: "block-seq",
              offset: this.offset,
              indent: this.indent,
              items: [{ start: [this.sourceToken] }]
            };
          case "explicit-key-ind": {
            this.onKeyLine = true;
            const prev = getPrevProps(parent);
            const start = getFirstKeyStartProps(prev);
            start.push(this.sourceToken);
            return {
              type: "block-map",
              offset: this.offset,
              indent: this.indent,
              items: [{ start, explicitKey: true }]
            };
          }
          case "map-value-ind": {
            this.onKeyLine = true;
            const prev = getPrevProps(parent);
            const start = getFirstKeyStartProps(prev);
            return {
              type: "block-map",
              offset: this.offset,
              indent: this.indent,
              items: [{ start, key: null, sep: [this.sourceToken] }]
            };
          }
        }
        return null;
      }
      atIndentedComment(start, indent) {
        if (this.type !== "comment")
          return false;
        if (this.indent <= indent)
          return false;
        return start.every((st) => st.type === "newline" || st.type === "space");
      }
      *documentEnd(docEnd) {
        if (this.type !== "doc-mode") {
          if (docEnd.end)
            docEnd.end.push(this.sourceToken);
          else
            docEnd.end = [this.sourceToken];
          if (this.type === "newline")
            yield* this.pop();
        }
      }
      *lineEnd(token) {
        switch (this.type) {
          case "comma":
          case "doc-start":
          case "doc-end":
          case "flow-seq-end":
          case "flow-map-end":
          case "map-value-ind":
            yield* this.pop();
            yield* this.step();
            break;
          case "newline":
            this.onKeyLine = false;
          // fallthrough
          case "space":
          case "comment":
          default:
            if (token.end)
              token.end.push(this.sourceToken);
            else
              token.end = [this.sourceToken];
            if (this.type === "newline")
              yield* this.pop();
        }
      }
    };
    exports.Parser = Parser;
  }
});

// node_modules/yaml/dist/public-api.js
var require_public_api = __commonJS({
  "node_modules/yaml/dist/public-api.js"(exports) {
    "use strict";
    var composer = require_composer();
    var Document = require_Document();
    var errors = require_errors();
    var log = require_log();
    var identity = require_identity();
    var lineCounter = require_line_counter();
    var parser = require_parser();
    function parseOptions(options) {
      const prettyErrors = options.prettyErrors !== false;
      const lineCounter$1 = options.lineCounter || prettyErrors && new lineCounter.LineCounter() || null;
      return { lineCounter: lineCounter$1, prettyErrors };
    }
    function parseAllDocuments(source, options = {}) {
      const { lineCounter: lineCounter2, prettyErrors } = parseOptions(options);
      const parser$1 = new parser.Parser(lineCounter2?.addNewLine);
      const composer$1 = new composer.Composer(options);
      const docs = Array.from(composer$1.compose(parser$1.parse(source)));
      if (prettyErrors && lineCounter2)
        for (const doc of docs) {
          doc.errors.forEach(errors.prettifyError(source, lineCounter2));
          doc.warnings.forEach(errors.prettifyError(source, lineCounter2));
        }
      if (docs.length > 0)
        return docs;
      return Object.assign([], { empty: true }, composer$1.streamInfo());
    }
    function parseDocument(source, options = {}) {
      const { lineCounter: lineCounter2, prettyErrors } = parseOptions(options);
      const parser$1 = new parser.Parser(lineCounter2?.addNewLine);
      const composer$1 = new composer.Composer(options);
      let doc = null;
      for (const _doc of composer$1.compose(parser$1.parse(source), true, source.length)) {
        if (!doc)
          doc = _doc;
        else if (doc.options.logLevel !== "silent") {
          doc.errors.push(new errors.YAMLParseError(_doc.range.slice(0, 2), "MULTIPLE_DOCS", "Source contains multiple documents; please use YAML.parseAllDocuments()"));
          break;
        }
      }
      if (prettyErrors && lineCounter2) {
        doc.errors.forEach(errors.prettifyError(source, lineCounter2));
        doc.warnings.forEach(errors.prettifyError(source, lineCounter2));
      }
      return doc;
    }
    function parse(src, reviver, options) {
      let _reviver = void 0;
      if (typeof reviver === "function") {
        _reviver = reviver;
      } else if (options === void 0 && reviver && typeof reviver === "object") {
        options = reviver;
      }
      const doc = parseDocument(src, options);
      if (!doc)
        return null;
      doc.warnings.forEach((warning) => log.warn(doc.options.logLevel, warning));
      if (doc.errors.length > 0) {
        if (doc.options.logLevel !== "silent")
          throw doc.errors[0];
        else
          doc.errors = [];
      }
      return doc.toJS(Object.assign({ reviver: _reviver }, options));
    }
    function stringify(value, replacer, options) {
      let _replacer = null;
      if (typeof replacer === "function" || Array.isArray(replacer)) {
        _replacer = replacer;
      } else if (options === void 0 && replacer) {
        options = replacer;
      }
      if (typeof options === "string")
        options = options.length;
      if (typeof options === "number") {
        const indent = Math.round(options);
        options = indent < 1 ? void 0 : indent > 8 ? { indent: 8 } : { indent };
      }
      if (value === void 0) {
        const { keepUndefined } = options ?? replacer ?? {};
        if (!keepUndefined)
          return void 0;
      }
      if (identity.isDocument(value) && !_replacer)
        return value.toString(options);
      return new Document.Document(value, _replacer, options).toString(options);
    }
    exports.parse = parse;
    exports.parseAllDocuments = parseAllDocuments;
    exports.parseDocument = parseDocument;
    exports.stringify = stringify;
  }
});

// node_modules/yaml/dist/index.js
var require_dist = __commonJS({
  "node_modules/yaml/dist/index.js"(exports) {
    "use strict";
    var composer = require_composer();
    var Document = require_Document();
    var Schema = require_Schema();
    var errors = require_errors();
    var Alias = require_Alias();
    var identity = require_identity();
    var Pair = require_Pair();
    var Scalar = require_Scalar();
    var YAMLMap = require_YAMLMap();
    var YAMLSeq = require_YAMLSeq();
    var cst = require_cst();
    var lexer = require_lexer();
    var lineCounter = require_line_counter();
    var parser = require_parser();
    var publicApi = require_public_api();
    var visit = require_visit();
    exports.Composer = composer.Composer;
    exports.Document = Document.Document;
    exports.Schema = Schema.Schema;
    exports.YAMLError = errors.YAMLError;
    exports.YAMLParseError = errors.YAMLParseError;
    exports.YAMLWarning = errors.YAMLWarning;
    exports.Alias = Alias.Alias;
    exports.isAlias = identity.isAlias;
    exports.isCollection = identity.isCollection;
    exports.isDocument = identity.isDocument;
    exports.isMap = identity.isMap;
    exports.isNode = identity.isNode;
    exports.isPair = identity.isPair;
    exports.isScalar = identity.isScalar;
    exports.isSeq = identity.isSeq;
    exports.Pair = Pair.Pair;
    exports.Scalar = Scalar.Scalar;
    exports.YAMLMap = YAMLMap.YAMLMap;
    exports.YAMLSeq = YAMLSeq.YAMLSeq;
    exports.CST = cst;
    exports.Lexer = lexer.Lexer;
    exports.LineCounter = lineCounter.LineCounter;
    exports.Parser = parser.Parser;
    exports.parse = publicApi.parse;
    exports.parseAllDocuments = publicApi.parseAllDocuments;
    exports.parseDocument = publicApi.parseDocument;
    exports.stringify = publicApi.stringify;
    exports.visit = visit.visit;
    exports.visitAsync = visit.visitAsync;
  }
});

// dist/cli/circuit.js
import { randomUUID as randomUUID7 } from "node:crypto";
import { existsSync as existsSync13, readFileSync as readFileSync25 } from "node:fs";
import { dirname as dirname10, resolve as resolve12 } from "node:path";
import { fileURLToPath as fileURLToPath2 } from "node:url";

// dist/runtime/run/checkpoint-resume.js
import { readFileSync as readFileSync16 } from "node:fs";

// dist/flows/catalog-derivations.js
function buildBuilderRegistry(packages, slot, pluck) {
  const map = /* @__PURE__ */ new Map();
  for (const pkg of packages) {
    for (const builder of pluck(pkg)) {
      if (map.has(builder.resultSchemaName)) {
        throw new Error(`duplicate ${slot} builder registered for schema '${builder.resultSchemaName}' (flow ${pkg.id})`);
      }
      map.set(builder.resultSchemaName, builder);
    }
  }
  return map;
}
function buildComposeRegistry(packages) {
  return buildBuilderRegistry(packages, "compose", (pkg) => pkg.writers.compose);
}
function buildCloseRegistry(packages) {
  return buildBuilderRegistry(packages, "close", (pkg) => pkg.writers.close);
}
function buildVerificationRegistry(packages) {
  return buildBuilderRegistry(packages, "verification", (pkg) => pkg.writers.verification);
}
function buildCheckpointRegistry(packages) {
  return buildBuilderRegistry(packages, "checkpoint", (pkg) => pkg.writers.checkpoint);
}
function buildReportSchemaRegistry(packages, fixtures = {}) {
  const out = { ...fixtures };
  for (const pkg of packages) {
    for (const report of pkg.relayReports) {
      if (Object.hasOwn(out, report.schemaName)) {
        throw new Error(`duplicate relay report schema '${report.schemaName}' registered (flow ${pkg.id})`);
      }
      out[report.schemaName] = report.schema;
    }
  }
  return Object.freeze(out);
}
function buildSchemaHintMap(packages) {
  const map = /* @__PURE__ */ new Map();
  for (const pkg of packages) {
    for (const report of pkg.relayReports) {
      if (report.relayHint === void 0)
        continue;
      if (map.has(report.schemaName)) {
        throw new Error(`duplicate shape hint registered for schema '${report.schemaName}' (flow ${pkg.id})`);
      }
      map.set(report.schemaName, report.relayHint);
    }
  }
  return map;
}
function buildCrossReportValidatorRegistry(packages) {
  const map = /* @__PURE__ */ new Map();
  for (const pkg of packages) {
    for (const report of pkg.relayReports) {
      if (report.crossReportValidate === void 0)
        continue;
      if (map.has(report.schemaName)) {
        throw new Error(`duplicate cross-report validator registered for schema '${report.schemaName}' (flow ${pkg.id})`);
      }
      map.set(report.schemaName, report.crossReportValidate);
    }
  }
  return map;
}
function buildStructuralHintList(packages) {
  const list = [];
  const seen = /* @__PURE__ */ new Set();
  for (const pkg of packages) {
    if (pkg.structuralHints === void 0)
      continue;
    for (const hint of pkg.structuralHints) {
      if (seen.has(hint.id)) {
        throw new Error(`duplicate structural shape hint id '${hint.id}' (flow ${pkg.id})`);
      }
      seen.add(hint.id);
      list.push(hint);
    }
  }
  return list;
}
function buildRoutablePackages(packages) {
  const out = [];
  for (const pkg of packages) {
    if (pkg.routing === void 0)
      continue;
    out.push({ pkg, routing: pkg.routing });
  }
  return out.sort((a, b) => a.routing.order - b.routing.order);
}
function findDefaultRoutablePackage(routables) {
  const defaults = routables.filter((entry) => entry.routing.isDefault === true);
  const [first, ...rest] = defaults;
  if (first === void 0) {
    throw new Error("no flow package marked isDefault \u2014 router has no fallback");
  }
  if (rest.length > 0) {
    throw new Error(`more than one default flow package: ${defaults.map((entry) => entry.pkg.id).join(", ")}`);
  }
  return first;
}

// dist/flows/build/relay-hints.js
var buildImplementationShapeHint = {
  kind: "schema",
  schema: "build.implementation@v1",
  instruction: [
    "Respond with a single raw JSON object whose top-level shape is exactly:",
    '{ "verdict": "accept", "summary": "<what changed>", "changed_files": ["<project-relative path>"], "evidence": ["<verification or implementation evidence>"] }',
    "Make the smallest behaviorally scoped change that satisfies the requested goal. Do not broaden semantics, normalize data, or add extra behavior just because tests still pass.",
    "Use an empty changed_files array only when no file changed. Evidence must contain at least one item. Do not include extra top-level keys. Do not wrap the JSON in Markdown code fences. Do not include any prose before or after the JSON object.",
    "The runtime parses your response with JSON.parse, rejects any verdict not drawn from the accepted-verdicts list, and validates the full report body against build.implementation@v1 before writing reports/build/implementation.json."
  ].join(" ")
};
var buildReviewShapeHint = {
  kind: "schema",
  schema: "build.review@v1",
  instruction: [
    "Respond with a single raw JSON object whose top-level shape is exactly:",
    '{ "verdict": "<accept|accept-with-fixes|reject>", "summary": "<review summary>", "findings": [{ "severity": "<critical|high|medium|low>", "text": "<finding text>", "file_refs": ["<file:line reference>"] }] }',
    "Review the change against the requested scope, not just against passing tests. Flag behavior that broadens semantics beyond the goal even when verification passes.",
    'Use an empty findings array only with verdict "accept". Verdicts "accept-with-fixes" and "reject" must include at least one finding. Use an empty file_refs array when a finding has no file-specific reference. Do not include extra top-level keys. Do not wrap the JSON in Markdown code fences. Do not include any prose before or after the JSON object.',
    "The runtime parses your response with JSON.parse, rejects any verdict not drawn from the accepted-verdicts list, and validates the full report body against build.review@v1 before writing reports/build/review.json."
  ].join(" ")
};

// node_modules/zod/v3/external.js
var external_exports = {};
__export(external_exports, {
  BRAND: () => BRAND,
  DIRTY: () => DIRTY,
  EMPTY_PATH: () => EMPTY_PATH,
  INVALID: () => INVALID,
  NEVER: () => NEVER,
  OK: () => OK,
  ParseStatus: () => ParseStatus,
  Schema: () => ZodType,
  ZodAny: () => ZodAny,
  ZodArray: () => ZodArray,
  ZodBigInt: () => ZodBigInt,
  ZodBoolean: () => ZodBoolean,
  ZodBranded: () => ZodBranded,
  ZodCatch: () => ZodCatch,
  ZodDate: () => ZodDate,
  ZodDefault: () => ZodDefault,
  ZodDiscriminatedUnion: () => ZodDiscriminatedUnion,
  ZodEffects: () => ZodEffects,
  ZodEnum: () => ZodEnum,
  ZodError: () => ZodError,
  ZodFirstPartyTypeKind: () => ZodFirstPartyTypeKind,
  ZodFunction: () => ZodFunction,
  ZodIntersection: () => ZodIntersection,
  ZodIssueCode: () => ZodIssueCode,
  ZodLazy: () => ZodLazy,
  ZodLiteral: () => ZodLiteral,
  ZodMap: () => ZodMap,
  ZodNaN: () => ZodNaN,
  ZodNativeEnum: () => ZodNativeEnum,
  ZodNever: () => ZodNever,
  ZodNull: () => ZodNull,
  ZodNullable: () => ZodNullable,
  ZodNumber: () => ZodNumber,
  ZodObject: () => ZodObject,
  ZodOptional: () => ZodOptional,
  ZodParsedType: () => ZodParsedType,
  ZodPipeline: () => ZodPipeline,
  ZodPromise: () => ZodPromise,
  ZodReadonly: () => ZodReadonly,
  ZodRecord: () => ZodRecord,
  ZodSchema: () => ZodType,
  ZodSet: () => ZodSet,
  ZodString: () => ZodString,
  ZodSymbol: () => ZodSymbol,
  ZodTransformer: () => ZodEffects,
  ZodTuple: () => ZodTuple,
  ZodType: () => ZodType,
  ZodUndefined: () => ZodUndefined,
  ZodUnion: () => ZodUnion,
  ZodUnknown: () => ZodUnknown,
  ZodVoid: () => ZodVoid,
  addIssueToContext: () => addIssueToContext,
  any: () => anyType,
  array: () => arrayType,
  bigint: () => bigIntType,
  boolean: () => booleanType,
  coerce: () => coerce,
  custom: () => custom,
  date: () => dateType,
  datetimeRegex: () => datetimeRegex,
  defaultErrorMap: () => en_default,
  discriminatedUnion: () => discriminatedUnionType,
  effect: () => effectsType,
  enum: () => enumType,
  function: () => functionType,
  getErrorMap: () => getErrorMap,
  getParsedType: () => getParsedType,
  instanceof: () => instanceOfType,
  intersection: () => intersectionType,
  isAborted: () => isAborted,
  isAsync: () => isAsync,
  isDirty: () => isDirty,
  isValid: () => isValid,
  late: () => late,
  lazy: () => lazyType,
  literal: () => literalType,
  makeIssue: () => makeIssue,
  map: () => mapType,
  nan: () => nanType,
  nativeEnum: () => nativeEnumType,
  never: () => neverType,
  null: () => nullType,
  nullable: () => nullableType,
  number: () => numberType,
  object: () => objectType,
  objectUtil: () => objectUtil,
  oboolean: () => oboolean,
  onumber: () => onumber,
  optional: () => optionalType,
  ostring: () => ostring,
  pipeline: () => pipelineType,
  preprocess: () => preprocessType,
  promise: () => promiseType,
  quotelessJson: () => quotelessJson,
  record: () => recordType,
  set: () => setType,
  setErrorMap: () => setErrorMap,
  strictObject: () => strictObjectType,
  string: () => stringType,
  symbol: () => symbolType,
  transformer: () => effectsType,
  tuple: () => tupleType,
  undefined: () => undefinedType,
  union: () => unionType,
  unknown: () => unknownType,
  util: () => util,
  void: () => voidType
});

// node_modules/zod/v3/helpers/util.js
var util;
(function(util2) {
  util2.assertEqual = (_) => {
  };
  function assertIs(_arg) {
  }
  util2.assertIs = assertIs;
  function assertNever(_x) {
    throw new Error();
  }
  util2.assertNever = assertNever;
  util2.arrayToEnum = (items) => {
    const obj = {};
    for (const item of items) {
      obj[item] = item;
    }
    return obj;
  };
  util2.getValidEnumValues = (obj) => {
    const validKeys = util2.objectKeys(obj).filter((k) => typeof obj[obj[k]] !== "number");
    const filtered = {};
    for (const k of validKeys) {
      filtered[k] = obj[k];
    }
    return util2.objectValues(filtered);
  };
  util2.objectValues = (obj) => {
    return util2.objectKeys(obj).map(function(e) {
      return obj[e];
    });
  };
  util2.objectKeys = typeof Object.keys === "function" ? (obj) => Object.keys(obj) : (object) => {
    const keys = [];
    for (const key in object) {
      if (Object.prototype.hasOwnProperty.call(object, key)) {
        keys.push(key);
      }
    }
    return keys;
  };
  util2.find = (arr, checker) => {
    for (const item of arr) {
      if (checker(item))
        return item;
    }
    return void 0;
  };
  util2.isInteger = typeof Number.isInteger === "function" ? (val) => Number.isInteger(val) : (val) => typeof val === "number" && Number.isFinite(val) && Math.floor(val) === val;
  function joinValues(array, separator = " | ") {
    return array.map((val) => typeof val === "string" ? `'${val}'` : val).join(separator);
  }
  util2.joinValues = joinValues;
  util2.jsonStringifyReplacer = (_, value) => {
    if (typeof value === "bigint") {
      return value.toString();
    }
    return value;
  };
})(util || (util = {}));
var objectUtil;
(function(objectUtil2) {
  objectUtil2.mergeShapes = (first, second) => {
    return {
      ...first,
      ...second
      // second overwrites first
    };
  };
})(objectUtil || (objectUtil = {}));
var ZodParsedType = util.arrayToEnum([
  "string",
  "nan",
  "number",
  "integer",
  "float",
  "boolean",
  "date",
  "bigint",
  "symbol",
  "function",
  "undefined",
  "null",
  "array",
  "object",
  "unknown",
  "promise",
  "void",
  "never",
  "map",
  "set"
]);
var getParsedType = (data) => {
  const t = typeof data;
  switch (t) {
    case "undefined":
      return ZodParsedType.undefined;
    case "string":
      return ZodParsedType.string;
    case "number":
      return Number.isNaN(data) ? ZodParsedType.nan : ZodParsedType.number;
    case "boolean":
      return ZodParsedType.boolean;
    case "function":
      return ZodParsedType.function;
    case "bigint":
      return ZodParsedType.bigint;
    case "symbol":
      return ZodParsedType.symbol;
    case "object":
      if (Array.isArray(data)) {
        return ZodParsedType.array;
      }
      if (data === null) {
        return ZodParsedType.null;
      }
      if (data.then && typeof data.then === "function" && data.catch && typeof data.catch === "function") {
        return ZodParsedType.promise;
      }
      if (typeof Map !== "undefined" && data instanceof Map) {
        return ZodParsedType.map;
      }
      if (typeof Set !== "undefined" && data instanceof Set) {
        return ZodParsedType.set;
      }
      if (typeof Date !== "undefined" && data instanceof Date) {
        return ZodParsedType.date;
      }
      return ZodParsedType.object;
    default:
      return ZodParsedType.unknown;
  }
};

// node_modules/zod/v3/ZodError.js
var ZodIssueCode = util.arrayToEnum([
  "invalid_type",
  "invalid_literal",
  "custom",
  "invalid_union",
  "invalid_union_discriminator",
  "invalid_enum_value",
  "unrecognized_keys",
  "invalid_arguments",
  "invalid_return_type",
  "invalid_date",
  "invalid_string",
  "too_small",
  "too_big",
  "invalid_intersection_types",
  "not_multiple_of",
  "not_finite"
]);
var quotelessJson = (obj) => {
  const json = JSON.stringify(obj, null, 2);
  return json.replace(/"([^"]+)":/g, "$1:");
};
var ZodError = class _ZodError extends Error {
  get errors() {
    return this.issues;
  }
  constructor(issues) {
    super();
    this.issues = [];
    this.addIssue = (sub) => {
      this.issues = [...this.issues, sub];
    };
    this.addIssues = (subs = []) => {
      this.issues = [...this.issues, ...subs];
    };
    const actualProto = new.target.prototype;
    if (Object.setPrototypeOf) {
      Object.setPrototypeOf(this, actualProto);
    } else {
      this.__proto__ = actualProto;
    }
    this.name = "ZodError";
    this.issues = issues;
  }
  format(_mapper) {
    const mapper = _mapper || function(issue) {
      return issue.message;
    };
    const fieldErrors = { _errors: [] };
    const processError = (error) => {
      for (const issue of error.issues) {
        if (issue.code === "invalid_union") {
          issue.unionErrors.map(processError);
        } else if (issue.code === "invalid_return_type") {
          processError(issue.returnTypeError);
        } else if (issue.code === "invalid_arguments") {
          processError(issue.argumentsError);
        } else if (issue.path.length === 0) {
          fieldErrors._errors.push(mapper(issue));
        } else {
          let curr = fieldErrors;
          let i = 0;
          while (i < issue.path.length) {
            const el = issue.path[i];
            const terminal = i === issue.path.length - 1;
            if (!terminal) {
              curr[el] = curr[el] || { _errors: [] };
            } else {
              curr[el] = curr[el] || { _errors: [] };
              curr[el]._errors.push(mapper(issue));
            }
            curr = curr[el];
            i++;
          }
        }
      }
    };
    processError(this);
    return fieldErrors;
  }
  static assert(value) {
    if (!(value instanceof _ZodError)) {
      throw new Error(`Not a ZodError: ${value}`);
    }
  }
  toString() {
    return this.message;
  }
  get message() {
    return JSON.stringify(this.issues, util.jsonStringifyReplacer, 2);
  }
  get isEmpty() {
    return this.issues.length === 0;
  }
  flatten(mapper = (issue) => issue.message) {
    const fieldErrors = {};
    const formErrors = [];
    for (const sub of this.issues) {
      if (sub.path.length > 0) {
        const firstEl = sub.path[0];
        fieldErrors[firstEl] = fieldErrors[firstEl] || [];
        fieldErrors[firstEl].push(mapper(sub));
      } else {
        formErrors.push(mapper(sub));
      }
    }
    return { formErrors, fieldErrors };
  }
  get formErrors() {
    return this.flatten();
  }
};
ZodError.create = (issues) => {
  const error = new ZodError(issues);
  return error;
};

// node_modules/zod/v3/locales/en.js
var errorMap = (issue, _ctx) => {
  let message;
  switch (issue.code) {
    case ZodIssueCode.invalid_type:
      if (issue.received === ZodParsedType.undefined) {
        message = "Required";
      } else {
        message = `Expected ${issue.expected}, received ${issue.received}`;
      }
      break;
    case ZodIssueCode.invalid_literal:
      message = `Invalid literal value, expected ${JSON.stringify(issue.expected, util.jsonStringifyReplacer)}`;
      break;
    case ZodIssueCode.unrecognized_keys:
      message = `Unrecognized key(s) in object: ${util.joinValues(issue.keys, ", ")}`;
      break;
    case ZodIssueCode.invalid_union:
      message = `Invalid input`;
      break;
    case ZodIssueCode.invalid_union_discriminator:
      message = `Invalid discriminator value. Expected ${util.joinValues(issue.options)}`;
      break;
    case ZodIssueCode.invalid_enum_value:
      message = `Invalid enum value. Expected ${util.joinValues(issue.options)}, received '${issue.received}'`;
      break;
    case ZodIssueCode.invalid_arguments:
      message = `Invalid function arguments`;
      break;
    case ZodIssueCode.invalid_return_type:
      message = `Invalid function return type`;
      break;
    case ZodIssueCode.invalid_date:
      message = `Invalid date`;
      break;
    case ZodIssueCode.invalid_string:
      if (typeof issue.validation === "object") {
        if ("includes" in issue.validation) {
          message = `Invalid input: must include "${issue.validation.includes}"`;
          if (typeof issue.validation.position === "number") {
            message = `${message} at one or more positions greater than or equal to ${issue.validation.position}`;
          }
        } else if ("startsWith" in issue.validation) {
          message = `Invalid input: must start with "${issue.validation.startsWith}"`;
        } else if ("endsWith" in issue.validation) {
          message = `Invalid input: must end with "${issue.validation.endsWith}"`;
        } else {
          util.assertNever(issue.validation);
        }
      } else if (issue.validation !== "regex") {
        message = `Invalid ${issue.validation}`;
      } else {
        message = "Invalid";
      }
      break;
    case ZodIssueCode.too_small:
      if (issue.type === "array")
        message = `Array must contain ${issue.exact ? "exactly" : issue.inclusive ? `at least` : `more than`} ${issue.minimum} element(s)`;
      else if (issue.type === "string")
        message = `String must contain ${issue.exact ? "exactly" : issue.inclusive ? `at least` : `over`} ${issue.minimum} character(s)`;
      else if (issue.type === "number")
        message = `Number must be ${issue.exact ? `exactly equal to ` : issue.inclusive ? `greater than or equal to ` : `greater than `}${issue.minimum}`;
      else if (issue.type === "bigint")
        message = `Number must be ${issue.exact ? `exactly equal to ` : issue.inclusive ? `greater than or equal to ` : `greater than `}${issue.minimum}`;
      else if (issue.type === "date")
        message = `Date must be ${issue.exact ? `exactly equal to ` : issue.inclusive ? `greater than or equal to ` : `greater than `}${new Date(Number(issue.minimum))}`;
      else
        message = "Invalid input";
      break;
    case ZodIssueCode.too_big:
      if (issue.type === "array")
        message = `Array must contain ${issue.exact ? `exactly` : issue.inclusive ? `at most` : `less than`} ${issue.maximum} element(s)`;
      else if (issue.type === "string")
        message = `String must contain ${issue.exact ? `exactly` : issue.inclusive ? `at most` : `under`} ${issue.maximum} character(s)`;
      else if (issue.type === "number")
        message = `Number must be ${issue.exact ? `exactly` : issue.inclusive ? `less than or equal to` : `less than`} ${issue.maximum}`;
      else if (issue.type === "bigint")
        message = `BigInt must be ${issue.exact ? `exactly` : issue.inclusive ? `less than or equal to` : `less than`} ${issue.maximum}`;
      else if (issue.type === "date")
        message = `Date must be ${issue.exact ? `exactly` : issue.inclusive ? `smaller than or equal to` : `smaller than`} ${new Date(Number(issue.maximum))}`;
      else
        message = "Invalid input";
      break;
    case ZodIssueCode.custom:
      message = `Invalid input`;
      break;
    case ZodIssueCode.invalid_intersection_types:
      message = `Intersection results could not be merged`;
      break;
    case ZodIssueCode.not_multiple_of:
      message = `Number must be a multiple of ${issue.multipleOf}`;
      break;
    case ZodIssueCode.not_finite:
      message = "Number must be finite";
      break;
    default:
      message = _ctx.defaultError;
      util.assertNever(issue);
  }
  return { message };
};
var en_default = errorMap;

// node_modules/zod/v3/errors.js
var overrideErrorMap = en_default;
function setErrorMap(map) {
  overrideErrorMap = map;
}
function getErrorMap() {
  return overrideErrorMap;
}

// node_modules/zod/v3/helpers/parseUtil.js
var makeIssue = (params) => {
  const { data, path, errorMaps, issueData } = params;
  const fullPath = [...path, ...issueData.path || []];
  const fullIssue = {
    ...issueData,
    path: fullPath
  };
  if (issueData.message !== void 0) {
    return {
      ...issueData,
      path: fullPath,
      message: issueData.message
    };
  }
  let errorMessage3 = "";
  const maps = errorMaps.filter((m) => !!m).slice().reverse();
  for (const map of maps) {
    errorMessage3 = map(fullIssue, { data, defaultError: errorMessage3 }).message;
  }
  return {
    ...issueData,
    path: fullPath,
    message: errorMessage3
  };
};
var EMPTY_PATH = [];
function addIssueToContext(ctx, issueData) {
  const overrideMap = getErrorMap();
  const issue = makeIssue({
    issueData,
    data: ctx.data,
    path: ctx.path,
    errorMaps: [
      ctx.common.contextualErrorMap,
      // contextual error map is first priority
      ctx.schemaErrorMap,
      // then schema-bound map if available
      overrideMap,
      // then global override map
      overrideMap === en_default ? void 0 : en_default
      // then global default map
    ].filter((x) => !!x)
  });
  ctx.common.issues.push(issue);
}
var ParseStatus = class _ParseStatus {
  constructor() {
    this.value = "valid";
  }
  dirty() {
    if (this.value === "valid")
      this.value = "dirty";
  }
  abort() {
    if (this.value !== "aborted")
      this.value = "aborted";
  }
  static mergeArray(status, results) {
    const arrayValue = [];
    for (const s of results) {
      if (s.status === "aborted")
        return INVALID;
      if (s.status === "dirty")
        status.dirty();
      arrayValue.push(s.value);
    }
    return { status: status.value, value: arrayValue };
  }
  static async mergeObjectAsync(status, pairs) {
    const syncPairs = [];
    for (const pair of pairs) {
      const key = await pair.key;
      const value = await pair.value;
      syncPairs.push({
        key,
        value
      });
    }
    return _ParseStatus.mergeObjectSync(status, syncPairs);
  }
  static mergeObjectSync(status, pairs) {
    const finalObject = {};
    for (const pair of pairs) {
      const { key, value } = pair;
      if (key.status === "aborted")
        return INVALID;
      if (value.status === "aborted")
        return INVALID;
      if (key.status === "dirty")
        status.dirty();
      if (value.status === "dirty")
        status.dirty();
      if (key.value !== "__proto__" && (typeof value.value !== "undefined" || pair.alwaysSet)) {
        finalObject[key.value] = value.value;
      }
    }
    return { status: status.value, value: finalObject };
  }
};
var INVALID = Object.freeze({
  status: "aborted"
});
var DIRTY = (value) => ({ status: "dirty", value });
var OK = (value) => ({ status: "valid", value });
var isAborted = (x) => x.status === "aborted";
var isDirty = (x) => x.status === "dirty";
var isValid = (x) => x.status === "valid";
var isAsync = (x) => typeof Promise !== "undefined" && x instanceof Promise;

// node_modules/zod/v3/helpers/errorUtil.js
var errorUtil;
(function(errorUtil2) {
  errorUtil2.errToObj = (message) => typeof message === "string" ? { message } : message || {};
  errorUtil2.toString = (message) => typeof message === "string" ? message : message?.message;
})(errorUtil || (errorUtil = {}));

// node_modules/zod/v3/types.js
var ParseInputLazyPath = class {
  constructor(parent, value, path, key) {
    this._cachedPath = [];
    this.parent = parent;
    this.data = value;
    this._path = path;
    this._key = key;
  }
  get path() {
    if (!this._cachedPath.length) {
      if (Array.isArray(this._key)) {
        this._cachedPath.push(...this._path, ...this._key);
      } else {
        this._cachedPath.push(...this._path, this._key);
      }
    }
    return this._cachedPath;
  }
};
var handleResult = (ctx, result) => {
  if (isValid(result)) {
    return { success: true, data: result.value };
  } else {
    if (!ctx.common.issues.length) {
      throw new Error("Validation failed but no issues detected.");
    }
    return {
      success: false,
      get error() {
        if (this._error)
          return this._error;
        const error = new ZodError(ctx.common.issues);
        this._error = error;
        return this._error;
      }
    };
  }
};
function processCreateParams(params) {
  if (!params)
    return {};
  const { errorMap: errorMap2, invalid_type_error, required_error, description } = params;
  if (errorMap2 && (invalid_type_error || required_error)) {
    throw new Error(`Can't use "invalid_type_error" or "required_error" in conjunction with custom error map.`);
  }
  if (errorMap2)
    return { errorMap: errorMap2, description };
  const customMap = (iss, ctx) => {
    const { message } = params;
    if (iss.code === "invalid_enum_value") {
      return { message: message ?? ctx.defaultError };
    }
    if (typeof ctx.data === "undefined") {
      return { message: message ?? required_error ?? ctx.defaultError };
    }
    if (iss.code !== "invalid_type")
      return { message: ctx.defaultError };
    return { message: message ?? invalid_type_error ?? ctx.defaultError };
  };
  return { errorMap: customMap, description };
}
var ZodType = class {
  get description() {
    return this._def.description;
  }
  _getType(input) {
    return getParsedType(input.data);
  }
  _getOrReturnCtx(input, ctx) {
    return ctx || {
      common: input.parent.common,
      data: input.data,
      parsedType: getParsedType(input.data),
      schemaErrorMap: this._def.errorMap,
      path: input.path,
      parent: input.parent
    };
  }
  _processInputParams(input) {
    return {
      status: new ParseStatus(),
      ctx: {
        common: input.parent.common,
        data: input.data,
        parsedType: getParsedType(input.data),
        schemaErrorMap: this._def.errorMap,
        path: input.path,
        parent: input.parent
      }
    };
  }
  _parseSync(input) {
    const result = this._parse(input);
    if (isAsync(result)) {
      throw new Error("Synchronous parse encountered promise.");
    }
    return result;
  }
  _parseAsync(input) {
    const result = this._parse(input);
    return Promise.resolve(result);
  }
  parse(data, params) {
    const result = this.safeParse(data, params);
    if (result.success)
      return result.data;
    throw result.error;
  }
  safeParse(data, params) {
    const ctx = {
      common: {
        issues: [],
        async: params?.async ?? false,
        contextualErrorMap: params?.errorMap
      },
      path: params?.path || [],
      schemaErrorMap: this._def.errorMap,
      parent: null,
      data,
      parsedType: getParsedType(data)
    };
    const result = this._parseSync({ data, path: ctx.path, parent: ctx });
    return handleResult(ctx, result);
  }
  "~validate"(data) {
    const ctx = {
      common: {
        issues: [],
        async: !!this["~standard"].async
      },
      path: [],
      schemaErrorMap: this._def.errorMap,
      parent: null,
      data,
      parsedType: getParsedType(data)
    };
    if (!this["~standard"].async) {
      try {
        const result = this._parseSync({ data, path: [], parent: ctx });
        return isValid(result) ? {
          value: result.value
        } : {
          issues: ctx.common.issues
        };
      } catch (err) {
        if (err?.message?.toLowerCase()?.includes("encountered")) {
          this["~standard"].async = true;
        }
        ctx.common = {
          issues: [],
          async: true
        };
      }
    }
    return this._parseAsync({ data, path: [], parent: ctx }).then((result) => isValid(result) ? {
      value: result.value
    } : {
      issues: ctx.common.issues
    });
  }
  async parseAsync(data, params) {
    const result = await this.safeParseAsync(data, params);
    if (result.success)
      return result.data;
    throw result.error;
  }
  async safeParseAsync(data, params) {
    const ctx = {
      common: {
        issues: [],
        contextualErrorMap: params?.errorMap,
        async: true
      },
      path: params?.path || [],
      schemaErrorMap: this._def.errorMap,
      parent: null,
      data,
      parsedType: getParsedType(data)
    };
    const maybeAsyncResult = this._parse({ data, path: ctx.path, parent: ctx });
    const result = await (isAsync(maybeAsyncResult) ? maybeAsyncResult : Promise.resolve(maybeAsyncResult));
    return handleResult(ctx, result);
  }
  refine(check, message) {
    const getIssueProperties = (val) => {
      if (typeof message === "string" || typeof message === "undefined") {
        return { message };
      } else if (typeof message === "function") {
        return message(val);
      } else {
        return message;
      }
    };
    return this._refinement((val, ctx) => {
      const result = check(val);
      const setError = () => ctx.addIssue({
        code: ZodIssueCode.custom,
        ...getIssueProperties(val)
      });
      if (typeof Promise !== "undefined" && result instanceof Promise) {
        return result.then((data) => {
          if (!data) {
            setError();
            return false;
          } else {
            return true;
          }
        });
      }
      if (!result) {
        setError();
        return false;
      } else {
        return true;
      }
    });
  }
  refinement(check, refinementData) {
    return this._refinement((val, ctx) => {
      if (!check(val)) {
        ctx.addIssue(typeof refinementData === "function" ? refinementData(val, ctx) : refinementData);
        return false;
      } else {
        return true;
      }
    });
  }
  _refinement(refinement) {
    return new ZodEffects({
      schema: this,
      typeName: ZodFirstPartyTypeKind.ZodEffects,
      effect: { type: "refinement", refinement }
    });
  }
  superRefine(refinement) {
    return this._refinement(refinement);
  }
  constructor(def) {
    this.spa = this.safeParseAsync;
    this._def = def;
    this.parse = this.parse.bind(this);
    this.safeParse = this.safeParse.bind(this);
    this.parseAsync = this.parseAsync.bind(this);
    this.safeParseAsync = this.safeParseAsync.bind(this);
    this.spa = this.spa.bind(this);
    this.refine = this.refine.bind(this);
    this.refinement = this.refinement.bind(this);
    this.superRefine = this.superRefine.bind(this);
    this.optional = this.optional.bind(this);
    this.nullable = this.nullable.bind(this);
    this.nullish = this.nullish.bind(this);
    this.array = this.array.bind(this);
    this.promise = this.promise.bind(this);
    this.or = this.or.bind(this);
    this.and = this.and.bind(this);
    this.transform = this.transform.bind(this);
    this.brand = this.brand.bind(this);
    this.default = this.default.bind(this);
    this.catch = this.catch.bind(this);
    this.describe = this.describe.bind(this);
    this.pipe = this.pipe.bind(this);
    this.readonly = this.readonly.bind(this);
    this.isNullable = this.isNullable.bind(this);
    this.isOptional = this.isOptional.bind(this);
    this["~standard"] = {
      version: 1,
      vendor: "zod",
      validate: (data) => this["~validate"](data)
    };
  }
  optional() {
    return ZodOptional.create(this, this._def);
  }
  nullable() {
    return ZodNullable.create(this, this._def);
  }
  nullish() {
    return this.nullable().optional();
  }
  array() {
    return ZodArray.create(this);
  }
  promise() {
    return ZodPromise.create(this, this._def);
  }
  or(option) {
    return ZodUnion.create([this, option], this._def);
  }
  and(incoming) {
    return ZodIntersection.create(this, incoming, this._def);
  }
  transform(transform) {
    return new ZodEffects({
      ...processCreateParams(this._def),
      schema: this,
      typeName: ZodFirstPartyTypeKind.ZodEffects,
      effect: { type: "transform", transform }
    });
  }
  default(def) {
    const defaultValueFunc = typeof def === "function" ? def : () => def;
    return new ZodDefault({
      ...processCreateParams(this._def),
      innerType: this,
      defaultValue: defaultValueFunc,
      typeName: ZodFirstPartyTypeKind.ZodDefault
    });
  }
  brand() {
    return new ZodBranded({
      typeName: ZodFirstPartyTypeKind.ZodBranded,
      type: this,
      ...processCreateParams(this._def)
    });
  }
  catch(def) {
    const catchValueFunc = typeof def === "function" ? def : () => def;
    return new ZodCatch({
      ...processCreateParams(this._def),
      innerType: this,
      catchValue: catchValueFunc,
      typeName: ZodFirstPartyTypeKind.ZodCatch
    });
  }
  describe(description) {
    const This = this.constructor;
    return new This({
      ...this._def,
      description
    });
  }
  pipe(target) {
    return ZodPipeline.create(this, target);
  }
  readonly() {
    return ZodReadonly.create(this);
  }
  isOptional() {
    return this.safeParse(void 0).success;
  }
  isNullable() {
    return this.safeParse(null).success;
  }
};
var cuidRegex = /^c[^\s-]{8,}$/i;
var cuid2Regex = /^[0-9a-z]+$/;
var ulidRegex = /^[0-9A-HJKMNP-TV-Z]{26}$/i;
var uuidRegex = /^[0-9a-fA-F]{8}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{12}$/i;
var nanoidRegex = /^[a-z0-9_-]{21}$/i;
var jwtRegex = /^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]*$/;
var durationRegex = /^[-+]?P(?!$)(?:(?:[-+]?\d+Y)|(?:[-+]?\d+[.,]\d+Y$))?(?:(?:[-+]?\d+M)|(?:[-+]?\d+[.,]\d+M$))?(?:(?:[-+]?\d+W)|(?:[-+]?\d+[.,]\d+W$))?(?:(?:[-+]?\d+D)|(?:[-+]?\d+[.,]\d+D$))?(?:T(?=[\d+-])(?:(?:[-+]?\d+H)|(?:[-+]?\d+[.,]\d+H$))?(?:(?:[-+]?\d+M)|(?:[-+]?\d+[.,]\d+M$))?(?:[-+]?\d+(?:[.,]\d+)?S)?)??$/;
var emailRegex = /^(?!\.)(?!.*\.\.)([A-Z0-9_'+\-\.]*)[A-Z0-9_+-]@([A-Z0-9][A-Z0-9\-]*\.)+[A-Z]{2,}$/i;
var _emojiRegex = `^(\\p{Extended_Pictographic}|\\p{Emoji_Component})+$`;
var emojiRegex;
var ipv4Regex = /^(?:(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\.){3}(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])$/;
var ipv4CidrRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\.){3}(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\/(3[0-2]|[12]?[0-9])$/;
var ipv6Regex = /^(([0-9a-fA-F]{1,4}:){7,7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]{1,}|::(ffff(:0{1,4}){0,1}:){0,1}((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])|([0-9a-fA-F]{1,4}:){1,4}:((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9]))$/;
var ipv6CidrRegex = /^(([0-9a-fA-F]{1,4}:){7,7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]{1,}|::(ffff(:0{1,4}){0,1}:){0,1}((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])|([0-9a-fA-F]{1,4}:){1,4}:((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9]))\/(12[0-8]|1[01][0-9]|[1-9]?[0-9])$/;
var base64Regex = /^([0-9a-zA-Z+/]{4})*(([0-9a-zA-Z+/]{2}==)|([0-9a-zA-Z+/]{3}=))?$/;
var base64urlRegex = /^([0-9a-zA-Z-_]{4})*(([0-9a-zA-Z-_]{2}(==)?)|([0-9a-zA-Z-_]{3}(=)?))?$/;
var dateRegexSource = `((\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-((0[13578]|1[02])-(0[1-9]|[12]\\d|3[01])|(0[469]|11)-(0[1-9]|[12]\\d|30)|(02)-(0[1-9]|1\\d|2[0-8])))`;
var dateRegex = new RegExp(`^${dateRegexSource}$`);
function timeRegexSource(args) {
  let secondsRegexSource = `[0-5]\\d`;
  if (args.precision) {
    secondsRegexSource = `${secondsRegexSource}\\.\\d{${args.precision}}`;
  } else if (args.precision == null) {
    secondsRegexSource = `${secondsRegexSource}(\\.\\d+)?`;
  }
  const secondsQuantifier = args.precision ? "+" : "?";
  return `([01]\\d|2[0-3]):[0-5]\\d(:${secondsRegexSource})${secondsQuantifier}`;
}
function timeRegex(args) {
  return new RegExp(`^${timeRegexSource(args)}$`);
}
function datetimeRegex(args) {
  let regex = `${dateRegexSource}T${timeRegexSource(args)}`;
  const opts = [];
  opts.push(args.local ? `Z?` : `Z`);
  if (args.offset)
    opts.push(`([+-]\\d{2}:?\\d{2})`);
  regex = `${regex}(${opts.join("|")})`;
  return new RegExp(`^${regex}$`);
}
function isValidIP(ip, version) {
  if ((version === "v4" || !version) && ipv4Regex.test(ip)) {
    return true;
  }
  if ((version === "v6" || !version) && ipv6Regex.test(ip)) {
    return true;
  }
  return false;
}
function isValidJWT(jwt, alg) {
  if (!jwtRegex.test(jwt))
    return false;
  try {
    const [header] = jwt.split(".");
    if (!header)
      return false;
    const base64 = header.replace(/-/g, "+").replace(/_/g, "/").padEnd(header.length + (4 - header.length % 4) % 4, "=");
    const decoded = JSON.parse(atob(base64));
    if (typeof decoded !== "object" || decoded === null)
      return false;
    if ("typ" in decoded && decoded?.typ !== "JWT")
      return false;
    if (!decoded.alg)
      return false;
    if (alg && decoded.alg !== alg)
      return false;
    return true;
  } catch {
    return false;
  }
}
function isValidCidr(ip, version) {
  if ((version === "v4" || !version) && ipv4CidrRegex.test(ip)) {
    return true;
  }
  if ((version === "v6" || !version) && ipv6CidrRegex.test(ip)) {
    return true;
  }
  return false;
}
var ZodString = class _ZodString extends ZodType {
  _parse(input) {
    if (this._def.coerce) {
      input.data = String(input.data);
    }
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.string) {
      const ctx2 = this._getOrReturnCtx(input);
      addIssueToContext(ctx2, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.string,
        received: ctx2.parsedType
      });
      return INVALID;
    }
    const status = new ParseStatus();
    let ctx = void 0;
    for (const check of this._def.checks) {
      if (check.kind === "min") {
        if (input.data.length < check.value) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_small,
            minimum: check.value,
            type: "string",
            inclusive: true,
            exact: false,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "max") {
        if (input.data.length > check.value) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_big,
            maximum: check.value,
            type: "string",
            inclusive: true,
            exact: false,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "length") {
        const tooBig = input.data.length > check.value;
        const tooSmall = input.data.length < check.value;
        if (tooBig || tooSmall) {
          ctx = this._getOrReturnCtx(input, ctx);
          if (tooBig) {
            addIssueToContext(ctx, {
              code: ZodIssueCode.too_big,
              maximum: check.value,
              type: "string",
              inclusive: true,
              exact: true,
              message: check.message
            });
          } else if (tooSmall) {
            addIssueToContext(ctx, {
              code: ZodIssueCode.too_small,
              minimum: check.value,
              type: "string",
              inclusive: true,
              exact: true,
              message: check.message
            });
          }
          status.dirty();
        }
      } else if (check.kind === "email") {
        if (!emailRegex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "email",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "emoji") {
        if (!emojiRegex) {
          emojiRegex = new RegExp(_emojiRegex, "u");
        }
        if (!emojiRegex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "emoji",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "uuid") {
        if (!uuidRegex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "uuid",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "nanoid") {
        if (!nanoidRegex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "nanoid",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "cuid") {
        if (!cuidRegex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "cuid",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "cuid2") {
        if (!cuid2Regex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "cuid2",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "ulid") {
        if (!ulidRegex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "ulid",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "url") {
        try {
          new URL(input.data);
        } catch {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "url",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "regex") {
        check.regex.lastIndex = 0;
        const testResult = check.regex.test(input.data);
        if (!testResult) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "regex",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "trim") {
        input.data = input.data.trim();
      } else if (check.kind === "includes") {
        if (!input.data.includes(check.value, check.position)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_string,
            validation: { includes: check.value, position: check.position },
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "toLowerCase") {
        input.data = input.data.toLowerCase();
      } else if (check.kind === "toUpperCase") {
        input.data = input.data.toUpperCase();
      } else if (check.kind === "startsWith") {
        if (!input.data.startsWith(check.value)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_string,
            validation: { startsWith: check.value },
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "endsWith") {
        if (!input.data.endsWith(check.value)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_string,
            validation: { endsWith: check.value },
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "datetime") {
        const regex = datetimeRegex(check);
        if (!regex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_string,
            validation: "datetime",
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "date") {
        const regex = dateRegex;
        if (!regex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_string,
            validation: "date",
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "time") {
        const regex = timeRegex(check);
        if (!regex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_string,
            validation: "time",
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "duration") {
        if (!durationRegex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "duration",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "ip") {
        if (!isValidIP(input.data, check.version)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "ip",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "jwt") {
        if (!isValidJWT(input.data, check.alg)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "jwt",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "cidr") {
        if (!isValidCidr(input.data, check.version)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "cidr",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "base64") {
        if (!base64Regex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "base64",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "base64url") {
        if (!base64urlRegex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "base64url",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else {
        util.assertNever(check);
      }
    }
    return { status: status.value, value: input.data };
  }
  _regex(regex, validation, message) {
    return this.refinement((data) => regex.test(data), {
      validation,
      code: ZodIssueCode.invalid_string,
      ...errorUtil.errToObj(message)
    });
  }
  _addCheck(check) {
    return new _ZodString({
      ...this._def,
      checks: [...this._def.checks, check]
    });
  }
  email(message) {
    return this._addCheck({ kind: "email", ...errorUtil.errToObj(message) });
  }
  url(message) {
    return this._addCheck({ kind: "url", ...errorUtil.errToObj(message) });
  }
  emoji(message) {
    return this._addCheck({ kind: "emoji", ...errorUtil.errToObj(message) });
  }
  uuid(message) {
    return this._addCheck({ kind: "uuid", ...errorUtil.errToObj(message) });
  }
  nanoid(message) {
    return this._addCheck({ kind: "nanoid", ...errorUtil.errToObj(message) });
  }
  cuid(message) {
    return this._addCheck({ kind: "cuid", ...errorUtil.errToObj(message) });
  }
  cuid2(message) {
    return this._addCheck({ kind: "cuid2", ...errorUtil.errToObj(message) });
  }
  ulid(message) {
    return this._addCheck({ kind: "ulid", ...errorUtil.errToObj(message) });
  }
  base64(message) {
    return this._addCheck({ kind: "base64", ...errorUtil.errToObj(message) });
  }
  base64url(message) {
    return this._addCheck({
      kind: "base64url",
      ...errorUtil.errToObj(message)
    });
  }
  jwt(options) {
    return this._addCheck({ kind: "jwt", ...errorUtil.errToObj(options) });
  }
  ip(options) {
    return this._addCheck({ kind: "ip", ...errorUtil.errToObj(options) });
  }
  cidr(options) {
    return this._addCheck({ kind: "cidr", ...errorUtil.errToObj(options) });
  }
  datetime(options) {
    if (typeof options === "string") {
      return this._addCheck({
        kind: "datetime",
        precision: null,
        offset: false,
        local: false,
        message: options
      });
    }
    return this._addCheck({
      kind: "datetime",
      precision: typeof options?.precision === "undefined" ? null : options?.precision,
      offset: options?.offset ?? false,
      local: options?.local ?? false,
      ...errorUtil.errToObj(options?.message)
    });
  }
  date(message) {
    return this._addCheck({ kind: "date", message });
  }
  time(options) {
    if (typeof options === "string") {
      return this._addCheck({
        kind: "time",
        precision: null,
        message: options
      });
    }
    return this._addCheck({
      kind: "time",
      precision: typeof options?.precision === "undefined" ? null : options?.precision,
      ...errorUtil.errToObj(options?.message)
    });
  }
  duration(message) {
    return this._addCheck({ kind: "duration", ...errorUtil.errToObj(message) });
  }
  regex(regex, message) {
    return this._addCheck({
      kind: "regex",
      regex,
      ...errorUtil.errToObj(message)
    });
  }
  includes(value, options) {
    return this._addCheck({
      kind: "includes",
      value,
      position: options?.position,
      ...errorUtil.errToObj(options?.message)
    });
  }
  startsWith(value, message) {
    return this._addCheck({
      kind: "startsWith",
      value,
      ...errorUtil.errToObj(message)
    });
  }
  endsWith(value, message) {
    return this._addCheck({
      kind: "endsWith",
      value,
      ...errorUtil.errToObj(message)
    });
  }
  min(minLength, message) {
    return this._addCheck({
      kind: "min",
      value: minLength,
      ...errorUtil.errToObj(message)
    });
  }
  max(maxLength, message) {
    return this._addCheck({
      kind: "max",
      value: maxLength,
      ...errorUtil.errToObj(message)
    });
  }
  length(len, message) {
    return this._addCheck({
      kind: "length",
      value: len,
      ...errorUtil.errToObj(message)
    });
  }
  /**
   * Equivalent to `.min(1)`
   */
  nonempty(message) {
    return this.min(1, errorUtil.errToObj(message));
  }
  trim() {
    return new _ZodString({
      ...this._def,
      checks: [...this._def.checks, { kind: "trim" }]
    });
  }
  toLowerCase() {
    return new _ZodString({
      ...this._def,
      checks: [...this._def.checks, { kind: "toLowerCase" }]
    });
  }
  toUpperCase() {
    return new _ZodString({
      ...this._def,
      checks: [...this._def.checks, { kind: "toUpperCase" }]
    });
  }
  get isDatetime() {
    return !!this._def.checks.find((ch) => ch.kind === "datetime");
  }
  get isDate() {
    return !!this._def.checks.find((ch) => ch.kind === "date");
  }
  get isTime() {
    return !!this._def.checks.find((ch) => ch.kind === "time");
  }
  get isDuration() {
    return !!this._def.checks.find((ch) => ch.kind === "duration");
  }
  get isEmail() {
    return !!this._def.checks.find((ch) => ch.kind === "email");
  }
  get isURL() {
    return !!this._def.checks.find((ch) => ch.kind === "url");
  }
  get isEmoji() {
    return !!this._def.checks.find((ch) => ch.kind === "emoji");
  }
  get isUUID() {
    return !!this._def.checks.find((ch) => ch.kind === "uuid");
  }
  get isNANOID() {
    return !!this._def.checks.find((ch) => ch.kind === "nanoid");
  }
  get isCUID() {
    return !!this._def.checks.find((ch) => ch.kind === "cuid");
  }
  get isCUID2() {
    return !!this._def.checks.find((ch) => ch.kind === "cuid2");
  }
  get isULID() {
    return !!this._def.checks.find((ch) => ch.kind === "ulid");
  }
  get isIP() {
    return !!this._def.checks.find((ch) => ch.kind === "ip");
  }
  get isCIDR() {
    return !!this._def.checks.find((ch) => ch.kind === "cidr");
  }
  get isBase64() {
    return !!this._def.checks.find((ch) => ch.kind === "base64");
  }
  get isBase64url() {
    return !!this._def.checks.find((ch) => ch.kind === "base64url");
  }
  get minLength() {
    let min = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "min") {
        if (min === null || ch.value > min)
          min = ch.value;
      }
    }
    return min;
  }
  get maxLength() {
    let max = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "max") {
        if (max === null || ch.value < max)
          max = ch.value;
      }
    }
    return max;
  }
};
ZodString.create = (params) => {
  return new ZodString({
    checks: [],
    typeName: ZodFirstPartyTypeKind.ZodString,
    coerce: params?.coerce ?? false,
    ...processCreateParams(params)
  });
};
function floatSafeRemainder(val, step) {
  const valDecCount = (val.toString().split(".")[1] || "").length;
  const stepDecCount = (step.toString().split(".")[1] || "").length;
  const decCount = valDecCount > stepDecCount ? valDecCount : stepDecCount;
  const valInt = Number.parseInt(val.toFixed(decCount).replace(".", ""));
  const stepInt = Number.parseInt(step.toFixed(decCount).replace(".", ""));
  return valInt % stepInt / 10 ** decCount;
}
var ZodNumber = class _ZodNumber extends ZodType {
  constructor() {
    super(...arguments);
    this.min = this.gte;
    this.max = this.lte;
    this.step = this.multipleOf;
  }
  _parse(input) {
    if (this._def.coerce) {
      input.data = Number(input.data);
    }
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.number) {
      const ctx2 = this._getOrReturnCtx(input);
      addIssueToContext(ctx2, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.number,
        received: ctx2.parsedType
      });
      return INVALID;
    }
    let ctx = void 0;
    const status = new ParseStatus();
    for (const check of this._def.checks) {
      if (check.kind === "int") {
        if (!util.isInteger(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_type,
            expected: "integer",
            received: "float",
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "min") {
        const tooSmall = check.inclusive ? input.data < check.value : input.data <= check.value;
        if (tooSmall) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_small,
            minimum: check.value,
            type: "number",
            inclusive: check.inclusive,
            exact: false,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "max") {
        const tooBig = check.inclusive ? input.data > check.value : input.data >= check.value;
        if (tooBig) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_big,
            maximum: check.value,
            type: "number",
            inclusive: check.inclusive,
            exact: false,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "multipleOf") {
        if (floatSafeRemainder(input.data, check.value) !== 0) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.not_multiple_of,
            multipleOf: check.value,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "finite") {
        if (!Number.isFinite(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.not_finite,
            message: check.message
          });
          status.dirty();
        }
      } else {
        util.assertNever(check);
      }
    }
    return { status: status.value, value: input.data };
  }
  gte(value, message) {
    return this.setLimit("min", value, true, errorUtil.toString(message));
  }
  gt(value, message) {
    return this.setLimit("min", value, false, errorUtil.toString(message));
  }
  lte(value, message) {
    return this.setLimit("max", value, true, errorUtil.toString(message));
  }
  lt(value, message) {
    return this.setLimit("max", value, false, errorUtil.toString(message));
  }
  setLimit(kind, value, inclusive, message) {
    return new _ZodNumber({
      ...this._def,
      checks: [
        ...this._def.checks,
        {
          kind,
          value,
          inclusive,
          message: errorUtil.toString(message)
        }
      ]
    });
  }
  _addCheck(check) {
    return new _ZodNumber({
      ...this._def,
      checks: [...this._def.checks, check]
    });
  }
  int(message) {
    return this._addCheck({
      kind: "int",
      message: errorUtil.toString(message)
    });
  }
  positive(message) {
    return this._addCheck({
      kind: "min",
      value: 0,
      inclusive: false,
      message: errorUtil.toString(message)
    });
  }
  negative(message) {
    return this._addCheck({
      kind: "max",
      value: 0,
      inclusive: false,
      message: errorUtil.toString(message)
    });
  }
  nonpositive(message) {
    return this._addCheck({
      kind: "max",
      value: 0,
      inclusive: true,
      message: errorUtil.toString(message)
    });
  }
  nonnegative(message) {
    return this._addCheck({
      kind: "min",
      value: 0,
      inclusive: true,
      message: errorUtil.toString(message)
    });
  }
  multipleOf(value, message) {
    return this._addCheck({
      kind: "multipleOf",
      value,
      message: errorUtil.toString(message)
    });
  }
  finite(message) {
    return this._addCheck({
      kind: "finite",
      message: errorUtil.toString(message)
    });
  }
  safe(message) {
    return this._addCheck({
      kind: "min",
      inclusive: true,
      value: Number.MIN_SAFE_INTEGER,
      message: errorUtil.toString(message)
    })._addCheck({
      kind: "max",
      inclusive: true,
      value: Number.MAX_SAFE_INTEGER,
      message: errorUtil.toString(message)
    });
  }
  get minValue() {
    let min = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "min") {
        if (min === null || ch.value > min)
          min = ch.value;
      }
    }
    return min;
  }
  get maxValue() {
    let max = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "max") {
        if (max === null || ch.value < max)
          max = ch.value;
      }
    }
    return max;
  }
  get isInt() {
    return !!this._def.checks.find((ch) => ch.kind === "int" || ch.kind === "multipleOf" && util.isInteger(ch.value));
  }
  get isFinite() {
    let max = null;
    let min = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "finite" || ch.kind === "int" || ch.kind === "multipleOf") {
        return true;
      } else if (ch.kind === "min") {
        if (min === null || ch.value > min)
          min = ch.value;
      } else if (ch.kind === "max") {
        if (max === null || ch.value < max)
          max = ch.value;
      }
    }
    return Number.isFinite(min) && Number.isFinite(max);
  }
};
ZodNumber.create = (params) => {
  return new ZodNumber({
    checks: [],
    typeName: ZodFirstPartyTypeKind.ZodNumber,
    coerce: params?.coerce || false,
    ...processCreateParams(params)
  });
};
var ZodBigInt = class _ZodBigInt extends ZodType {
  constructor() {
    super(...arguments);
    this.min = this.gte;
    this.max = this.lte;
  }
  _parse(input) {
    if (this._def.coerce) {
      try {
        input.data = BigInt(input.data);
      } catch {
        return this._getInvalidInput(input);
      }
    }
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.bigint) {
      return this._getInvalidInput(input);
    }
    let ctx = void 0;
    const status = new ParseStatus();
    for (const check of this._def.checks) {
      if (check.kind === "min") {
        const tooSmall = check.inclusive ? input.data < check.value : input.data <= check.value;
        if (tooSmall) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_small,
            type: "bigint",
            minimum: check.value,
            inclusive: check.inclusive,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "max") {
        const tooBig = check.inclusive ? input.data > check.value : input.data >= check.value;
        if (tooBig) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_big,
            type: "bigint",
            maximum: check.value,
            inclusive: check.inclusive,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "multipleOf") {
        if (input.data % check.value !== BigInt(0)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.not_multiple_of,
            multipleOf: check.value,
            message: check.message
          });
          status.dirty();
        }
      } else {
        util.assertNever(check);
      }
    }
    return { status: status.value, value: input.data };
  }
  _getInvalidInput(input) {
    const ctx = this._getOrReturnCtx(input);
    addIssueToContext(ctx, {
      code: ZodIssueCode.invalid_type,
      expected: ZodParsedType.bigint,
      received: ctx.parsedType
    });
    return INVALID;
  }
  gte(value, message) {
    return this.setLimit("min", value, true, errorUtil.toString(message));
  }
  gt(value, message) {
    return this.setLimit("min", value, false, errorUtil.toString(message));
  }
  lte(value, message) {
    return this.setLimit("max", value, true, errorUtil.toString(message));
  }
  lt(value, message) {
    return this.setLimit("max", value, false, errorUtil.toString(message));
  }
  setLimit(kind, value, inclusive, message) {
    return new _ZodBigInt({
      ...this._def,
      checks: [
        ...this._def.checks,
        {
          kind,
          value,
          inclusive,
          message: errorUtil.toString(message)
        }
      ]
    });
  }
  _addCheck(check) {
    return new _ZodBigInt({
      ...this._def,
      checks: [...this._def.checks, check]
    });
  }
  positive(message) {
    return this._addCheck({
      kind: "min",
      value: BigInt(0),
      inclusive: false,
      message: errorUtil.toString(message)
    });
  }
  negative(message) {
    return this._addCheck({
      kind: "max",
      value: BigInt(0),
      inclusive: false,
      message: errorUtil.toString(message)
    });
  }
  nonpositive(message) {
    return this._addCheck({
      kind: "max",
      value: BigInt(0),
      inclusive: true,
      message: errorUtil.toString(message)
    });
  }
  nonnegative(message) {
    return this._addCheck({
      kind: "min",
      value: BigInt(0),
      inclusive: true,
      message: errorUtil.toString(message)
    });
  }
  multipleOf(value, message) {
    return this._addCheck({
      kind: "multipleOf",
      value,
      message: errorUtil.toString(message)
    });
  }
  get minValue() {
    let min = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "min") {
        if (min === null || ch.value > min)
          min = ch.value;
      }
    }
    return min;
  }
  get maxValue() {
    let max = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "max") {
        if (max === null || ch.value < max)
          max = ch.value;
      }
    }
    return max;
  }
};
ZodBigInt.create = (params) => {
  return new ZodBigInt({
    checks: [],
    typeName: ZodFirstPartyTypeKind.ZodBigInt,
    coerce: params?.coerce ?? false,
    ...processCreateParams(params)
  });
};
var ZodBoolean = class extends ZodType {
  _parse(input) {
    if (this._def.coerce) {
      input.data = Boolean(input.data);
    }
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.boolean) {
      const ctx = this._getOrReturnCtx(input);
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.boolean,
        received: ctx.parsedType
      });
      return INVALID;
    }
    return OK(input.data);
  }
};
ZodBoolean.create = (params) => {
  return new ZodBoolean({
    typeName: ZodFirstPartyTypeKind.ZodBoolean,
    coerce: params?.coerce || false,
    ...processCreateParams(params)
  });
};
var ZodDate = class _ZodDate extends ZodType {
  _parse(input) {
    if (this._def.coerce) {
      input.data = new Date(input.data);
    }
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.date) {
      const ctx2 = this._getOrReturnCtx(input);
      addIssueToContext(ctx2, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.date,
        received: ctx2.parsedType
      });
      return INVALID;
    }
    if (Number.isNaN(input.data.getTime())) {
      const ctx2 = this._getOrReturnCtx(input);
      addIssueToContext(ctx2, {
        code: ZodIssueCode.invalid_date
      });
      return INVALID;
    }
    const status = new ParseStatus();
    let ctx = void 0;
    for (const check of this._def.checks) {
      if (check.kind === "min") {
        if (input.data.getTime() < check.value) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_small,
            message: check.message,
            inclusive: true,
            exact: false,
            minimum: check.value,
            type: "date"
          });
          status.dirty();
        }
      } else if (check.kind === "max") {
        if (input.data.getTime() > check.value) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_big,
            message: check.message,
            inclusive: true,
            exact: false,
            maximum: check.value,
            type: "date"
          });
          status.dirty();
        }
      } else {
        util.assertNever(check);
      }
    }
    return {
      status: status.value,
      value: new Date(input.data.getTime())
    };
  }
  _addCheck(check) {
    return new _ZodDate({
      ...this._def,
      checks: [...this._def.checks, check]
    });
  }
  min(minDate, message) {
    return this._addCheck({
      kind: "min",
      value: minDate.getTime(),
      message: errorUtil.toString(message)
    });
  }
  max(maxDate, message) {
    return this._addCheck({
      kind: "max",
      value: maxDate.getTime(),
      message: errorUtil.toString(message)
    });
  }
  get minDate() {
    let min = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "min") {
        if (min === null || ch.value > min)
          min = ch.value;
      }
    }
    return min != null ? new Date(min) : null;
  }
  get maxDate() {
    let max = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "max") {
        if (max === null || ch.value < max)
          max = ch.value;
      }
    }
    return max != null ? new Date(max) : null;
  }
};
ZodDate.create = (params) => {
  return new ZodDate({
    checks: [],
    coerce: params?.coerce || false,
    typeName: ZodFirstPartyTypeKind.ZodDate,
    ...processCreateParams(params)
  });
};
var ZodSymbol = class extends ZodType {
  _parse(input) {
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.symbol) {
      const ctx = this._getOrReturnCtx(input);
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.symbol,
        received: ctx.parsedType
      });
      return INVALID;
    }
    return OK(input.data);
  }
};
ZodSymbol.create = (params) => {
  return new ZodSymbol({
    typeName: ZodFirstPartyTypeKind.ZodSymbol,
    ...processCreateParams(params)
  });
};
var ZodUndefined = class extends ZodType {
  _parse(input) {
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.undefined) {
      const ctx = this._getOrReturnCtx(input);
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.undefined,
        received: ctx.parsedType
      });
      return INVALID;
    }
    return OK(input.data);
  }
};
ZodUndefined.create = (params) => {
  return new ZodUndefined({
    typeName: ZodFirstPartyTypeKind.ZodUndefined,
    ...processCreateParams(params)
  });
};
var ZodNull = class extends ZodType {
  _parse(input) {
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.null) {
      const ctx = this._getOrReturnCtx(input);
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.null,
        received: ctx.parsedType
      });
      return INVALID;
    }
    return OK(input.data);
  }
};
ZodNull.create = (params) => {
  return new ZodNull({
    typeName: ZodFirstPartyTypeKind.ZodNull,
    ...processCreateParams(params)
  });
};
var ZodAny = class extends ZodType {
  constructor() {
    super(...arguments);
    this._any = true;
  }
  _parse(input) {
    return OK(input.data);
  }
};
ZodAny.create = (params) => {
  return new ZodAny({
    typeName: ZodFirstPartyTypeKind.ZodAny,
    ...processCreateParams(params)
  });
};
var ZodUnknown = class extends ZodType {
  constructor() {
    super(...arguments);
    this._unknown = true;
  }
  _parse(input) {
    return OK(input.data);
  }
};
ZodUnknown.create = (params) => {
  return new ZodUnknown({
    typeName: ZodFirstPartyTypeKind.ZodUnknown,
    ...processCreateParams(params)
  });
};
var ZodNever = class extends ZodType {
  _parse(input) {
    const ctx = this._getOrReturnCtx(input);
    addIssueToContext(ctx, {
      code: ZodIssueCode.invalid_type,
      expected: ZodParsedType.never,
      received: ctx.parsedType
    });
    return INVALID;
  }
};
ZodNever.create = (params) => {
  return new ZodNever({
    typeName: ZodFirstPartyTypeKind.ZodNever,
    ...processCreateParams(params)
  });
};
var ZodVoid = class extends ZodType {
  _parse(input) {
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.undefined) {
      const ctx = this._getOrReturnCtx(input);
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.void,
        received: ctx.parsedType
      });
      return INVALID;
    }
    return OK(input.data);
  }
};
ZodVoid.create = (params) => {
  return new ZodVoid({
    typeName: ZodFirstPartyTypeKind.ZodVoid,
    ...processCreateParams(params)
  });
};
var ZodArray = class _ZodArray extends ZodType {
  _parse(input) {
    const { ctx, status } = this._processInputParams(input);
    const def = this._def;
    if (ctx.parsedType !== ZodParsedType.array) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.array,
        received: ctx.parsedType
      });
      return INVALID;
    }
    if (def.exactLength !== null) {
      const tooBig = ctx.data.length > def.exactLength.value;
      const tooSmall = ctx.data.length < def.exactLength.value;
      if (tooBig || tooSmall) {
        addIssueToContext(ctx, {
          code: tooBig ? ZodIssueCode.too_big : ZodIssueCode.too_small,
          minimum: tooSmall ? def.exactLength.value : void 0,
          maximum: tooBig ? def.exactLength.value : void 0,
          type: "array",
          inclusive: true,
          exact: true,
          message: def.exactLength.message
        });
        status.dirty();
      }
    }
    if (def.minLength !== null) {
      if (ctx.data.length < def.minLength.value) {
        addIssueToContext(ctx, {
          code: ZodIssueCode.too_small,
          minimum: def.minLength.value,
          type: "array",
          inclusive: true,
          exact: false,
          message: def.minLength.message
        });
        status.dirty();
      }
    }
    if (def.maxLength !== null) {
      if (ctx.data.length > def.maxLength.value) {
        addIssueToContext(ctx, {
          code: ZodIssueCode.too_big,
          maximum: def.maxLength.value,
          type: "array",
          inclusive: true,
          exact: false,
          message: def.maxLength.message
        });
        status.dirty();
      }
    }
    if (ctx.common.async) {
      return Promise.all([...ctx.data].map((item, i) => {
        return def.type._parseAsync(new ParseInputLazyPath(ctx, item, ctx.path, i));
      })).then((result2) => {
        return ParseStatus.mergeArray(status, result2);
      });
    }
    const result = [...ctx.data].map((item, i) => {
      return def.type._parseSync(new ParseInputLazyPath(ctx, item, ctx.path, i));
    });
    return ParseStatus.mergeArray(status, result);
  }
  get element() {
    return this._def.type;
  }
  min(minLength, message) {
    return new _ZodArray({
      ...this._def,
      minLength: { value: minLength, message: errorUtil.toString(message) }
    });
  }
  max(maxLength, message) {
    return new _ZodArray({
      ...this._def,
      maxLength: { value: maxLength, message: errorUtil.toString(message) }
    });
  }
  length(len, message) {
    return new _ZodArray({
      ...this._def,
      exactLength: { value: len, message: errorUtil.toString(message) }
    });
  }
  nonempty(message) {
    return this.min(1, message);
  }
};
ZodArray.create = (schema, params) => {
  return new ZodArray({
    type: schema,
    minLength: null,
    maxLength: null,
    exactLength: null,
    typeName: ZodFirstPartyTypeKind.ZodArray,
    ...processCreateParams(params)
  });
};
function deepPartialify(schema) {
  if (schema instanceof ZodObject) {
    const newShape = {};
    for (const key in schema.shape) {
      const fieldSchema = schema.shape[key];
      newShape[key] = ZodOptional.create(deepPartialify(fieldSchema));
    }
    return new ZodObject({
      ...schema._def,
      shape: () => newShape
    });
  } else if (schema instanceof ZodArray) {
    return new ZodArray({
      ...schema._def,
      type: deepPartialify(schema.element)
    });
  } else if (schema instanceof ZodOptional) {
    return ZodOptional.create(deepPartialify(schema.unwrap()));
  } else if (schema instanceof ZodNullable) {
    return ZodNullable.create(deepPartialify(schema.unwrap()));
  } else if (schema instanceof ZodTuple) {
    return ZodTuple.create(schema.items.map((item) => deepPartialify(item)));
  } else {
    return schema;
  }
}
var ZodObject = class _ZodObject extends ZodType {
  constructor() {
    super(...arguments);
    this._cached = null;
    this.nonstrict = this.passthrough;
    this.augment = this.extend;
  }
  _getCached() {
    if (this._cached !== null)
      return this._cached;
    const shape = this._def.shape();
    const keys = util.objectKeys(shape);
    this._cached = { shape, keys };
    return this._cached;
  }
  _parse(input) {
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.object) {
      const ctx2 = this._getOrReturnCtx(input);
      addIssueToContext(ctx2, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.object,
        received: ctx2.parsedType
      });
      return INVALID;
    }
    const { status, ctx } = this._processInputParams(input);
    const { shape, keys: shapeKeys } = this._getCached();
    const extraKeys = [];
    if (!(this._def.catchall instanceof ZodNever && this._def.unknownKeys === "strip")) {
      for (const key in ctx.data) {
        if (!shapeKeys.includes(key)) {
          extraKeys.push(key);
        }
      }
    }
    const pairs = [];
    for (const key of shapeKeys) {
      const keyValidator = shape[key];
      const value = ctx.data[key];
      pairs.push({
        key: { status: "valid", value: key },
        value: keyValidator._parse(new ParseInputLazyPath(ctx, value, ctx.path, key)),
        alwaysSet: key in ctx.data
      });
    }
    if (this._def.catchall instanceof ZodNever) {
      const unknownKeys = this._def.unknownKeys;
      if (unknownKeys === "passthrough") {
        for (const key of extraKeys) {
          pairs.push({
            key: { status: "valid", value: key },
            value: { status: "valid", value: ctx.data[key] }
          });
        }
      } else if (unknownKeys === "strict") {
        if (extraKeys.length > 0) {
          addIssueToContext(ctx, {
            code: ZodIssueCode.unrecognized_keys,
            keys: extraKeys
          });
          status.dirty();
        }
      } else if (unknownKeys === "strip") {
      } else {
        throw new Error(`Internal ZodObject error: invalid unknownKeys value.`);
      }
    } else {
      const catchall = this._def.catchall;
      for (const key of extraKeys) {
        const value = ctx.data[key];
        pairs.push({
          key: { status: "valid", value: key },
          value: catchall._parse(
            new ParseInputLazyPath(ctx, value, ctx.path, key)
            //, ctx.child(key), value, getParsedType(value)
          ),
          alwaysSet: key in ctx.data
        });
      }
    }
    if (ctx.common.async) {
      return Promise.resolve().then(async () => {
        const syncPairs = [];
        for (const pair of pairs) {
          const key = await pair.key;
          const value = await pair.value;
          syncPairs.push({
            key,
            value,
            alwaysSet: pair.alwaysSet
          });
        }
        return syncPairs;
      }).then((syncPairs) => {
        return ParseStatus.mergeObjectSync(status, syncPairs);
      });
    } else {
      return ParseStatus.mergeObjectSync(status, pairs);
    }
  }
  get shape() {
    return this._def.shape();
  }
  strict(message) {
    errorUtil.errToObj;
    return new _ZodObject({
      ...this._def,
      unknownKeys: "strict",
      ...message !== void 0 ? {
        errorMap: (issue, ctx) => {
          const defaultError = this._def.errorMap?.(issue, ctx).message ?? ctx.defaultError;
          if (issue.code === "unrecognized_keys")
            return {
              message: errorUtil.errToObj(message).message ?? defaultError
            };
          return {
            message: defaultError
          };
        }
      } : {}
    });
  }
  strip() {
    return new _ZodObject({
      ...this._def,
      unknownKeys: "strip"
    });
  }
  passthrough() {
    return new _ZodObject({
      ...this._def,
      unknownKeys: "passthrough"
    });
  }
  // const AugmentFactory =
  //   <Def extends ZodObjectDef>(def: Def) =>
  //   <Augmentation extends ZodRawShape>(
  //     augmentation: Augmentation
  //   ): ZodObject<
  //     extendShape<ReturnType<Def["shape"]>, Augmentation>,
  //     Def["unknownKeys"],
  //     Def["catchall"]
  //   > => {
  //     return new ZodObject({
  //       ...def,
  //       shape: () => ({
  //         ...def.shape(),
  //         ...augmentation,
  //       }),
  //     }) as any;
  //   };
  extend(augmentation) {
    return new _ZodObject({
      ...this._def,
      shape: () => ({
        ...this._def.shape(),
        ...augmentation
      })
    });
  }
  /**
   * Prior to zod@1.0.12 there was a bug in the
   * inferred type of merged objects. Please
   * upgrade if you are experiencing issues.
   */
  merge(merging) {
    const merged = new _ZodObject({
      unknownKeys: merging._def.unknownKeys,
      catchall: merging._def.catchall,
      shape: () => ({
        ...this._def.shape(),
        ...merging._def.shape()
      }),
      typeName: ZodFirstPartyTypeKind.ZodObject
    });
    return merged;
  }
  // merge<
  //   Incoming extends AnyZodObject,
  //   Augmentation extends Incoming["shape"],
  //   NewOutput extends {
  //     [k in keyof Augmentation | keyof Output]: k extends keyof Augmentation
  //       ? Augmentation[k]["_output"]
  //       : k extends keyof Output
  //       ? Output[k]
  //       : never;
  //   },
  //   NewInput extends {
  //     [k in keyof Augmentation | keyof Input]: k extends keyof Augmentation
  //       ? Augmentation[k]["_input"]
  //       : k extends keyof Input
  //       ? Input[k]
  //       : never;
  //   }
  // >(
  //   merging: Incoming
  // ): ZodObject<
  //   extendShape<T, ReturnType<Incoming["_def"]["shape"]>>,
  //   Incoming["_def"]["unknownKeys"],
  //   Incoming["_def"]["catchall"],
  //   NewOutput,
  //   NewInput
  // > {
  //   const merged: any = new ZodObject({
  //     unknownKeys: merging._def.unknownKeys,
  //     catchall: merging._def.catchall,
  //     shape: () =>
  //       objectUtil.mergeShapes(this._def.shape(), merging._def.shape()),
  //     typeName: ZodFirstPartyTypeKind.ZodObject,
  //   }) as any;
  //   return merged;
  // }
  setKey(key, schema) {
    return this.augment({ [key]: schema });
  }
  // merge<Incoming extends AnyZodObject>(
  //   merging: Incoming
  // ): //ZodObject<T & Incoming["_shape"], UnknownKeys, Catchall> = (merging) => {
  // ZodObject<
  //   extendShape<T, ReturnType<Incoming["_def"]["shape"]>>,
  //   Incoming["_def"]["unknownKeys"],
  //   Incoming["_def"]["catchall"]
  // > {
  //   // const mergedShape = objectUtil.mergeShapes(
  //   //   this._def.shape(),
  //   //   merging._def.shape()
  //   // );
  //   const merged: any = new ZodObject({
  //     unknownKeys: merging._def.unknownKeys,
  //     catchall: merging._def.catchall,
  //     shape: () =>
  //       objectUtil.mergeShapes(this._def.shape(), merging._def.shape()),
  //     typeName: ZodFirstPartyTypeKind.ZodObject,
  //   }) as any;
  //   return merged;
  // }
  catchall(index) {
    return new _ZodObject({
      ...this._def,
      catchall: index
    });
  }
  pick(mask) {
    const shape = {};
    for (const key of util.objectKeys(mask)) {
      if (mask[key] && this.shape[key]) {
        shape[key] = this.shape[key];
      }
    }
    return new _ZodObject({
      ...this._def,
      shape: () => shape
    });
  }
  omit(mask) {
    const shape = {};
    for (const key of util.objectKeys(this.shape)) {
      if (!mask[key]) {
        shape[key] = this.shape[key];
      }
    }
    return new _ZodObject({
      ...this._def,
      shape: () => shape
    });
  }
  /**
   * @deprecated
   */
  deepPartial() {
    return deepPartialify(this);
  }
  partial(mask) {
    const newShape = {};
    for (const key of util.objectKeys(this.shape)) {
      const fieldSchema = this.shape[key];
      if (mask && !mask[key]) {
        newShape[key] = fieldSchema;
      } else {
        newShape[key] = fieldSchema.optional();
      }
    }
    return new _ZodObject({
      ...this._def,
      shape: () => newShape
    });
  }
  required(mask) {
    const newShape = {};
    for (const key of util.objectKeys(this.shape)) {
      if (mask && !mask[key]) {
        newShape[key] = this.shape[key];
      } else {
        const fieldSchema = this.shape[key];
        let newField = fieldSchema;
        while (newField instanceof ZodOptional) {
          newField = newField._def.innerType;
        }
        newShape[key] = newField;
      }
    }
    return new _ZodObject({
      ...this._def,
      shape: () => newShape
    });
  }
  keyof() {
    return createZodEnum(util.objectKeys(this.shape));
  }
};
ZodObject.create = (shape, params) => {
  return new ZodObject({
    shape: () => shape,
    unknownKeys: "strip",
    catchall: ZodNever.create(),
    typeName: ZodFirstPartyTypeKind.ZodObject,
    ...processCreateParams(params)
  });
};
ZodObject.strictCreate = (shape, params) => {
  return new ZodObject({
    shape: () => shape,
    unknownKeys: "strict",
    catchall: ZodNever.create(),
    typeName: ZodFirstPartyTypeKind.ZodObject,
    ...processCreateParams(params)
  });
};
ZodObject.lazycreate = (shape, params) => {
  return new ZodObject({
    shape,
    unknownKeys: "strip",
    catchall: ZodNever.create(),
    typeName: ZodFirstPartyTypeKind.ZodObject,
    ...processCreateParams(params)
  });
};
var ZodUnion = class extends ZodType {
  _parse(input) {
    const { ctx } = this._processInputParams(input);
    const options = this._def.options;
    function handleResults(results) {
      for (const result of results) {
        if (result.result.status === "valid") {
          return result.result;
        }
      }
      for (const result of results) {
        if (result.result.status === "dirty") {
          ctx.common.issues.push(...result.ctx.common.issues);
          return result.result;
        }
      }
      const unionErrors = results.map((result) => new ZodError(result.ctx.common.issues));
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_union,
        unionErrors
      });
      return INVALID;
    }
    if (ctx.common.async) {
      return Promise.all(options.map(async (option) => {
        const childCtx = {
          ...ctx,
          common: {
            ...ctx.common,
            issues: []
          },
          parent: null
        };
        return {
          result: await option._parseAsync({
            data: ctx.data,
            path: ctx.path,
            parent: childCtx
          }),
          ctx: childCtx
        };
      })).then(handleResults);
    } else {
      let dirty = void 0;
      const issues = [];
      for (const option of options) {
        const childCtx = {
          ...ctx,
          common: {
            ...ctx.common,
            issues: []
          },
          parent: null
        };
        const result = option._parseSync({
          data: ctx.data,
          path: ctx.path,
          parent: childCtx
        });
        if (result.status === "valid") {
          return result;
        } else if (result.status === "dirty" && !dirty) {
          dirty = { result, ctx: childCtx };
        }
        if (childCtx.common.issues.length) {
          issues.push(childCtx.common.issues);
        }
      }
      if (dirty) {
        ctx.common.issues.push(...dirty.ctx.common.issues);
        return dirty.result;
      }
      const unionErrors = issues.map((issues2) => new ZodError(issues2));
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_union,
        unionErrors
      });
      return INVALID;
    }
  }
  get options() {
    return this._def.options;
  }
};
ZodUnion.create = (types, params) => {
  return new ZodUnion({
    options: types,
    typeName: ZodFirstPartyTypeKind.ZodUnion,
    ...processCreateParams(params)
  });
};
var getDiscriminator = (type) => {
  if (type instanceof ZodLazy) {
    return getDiscriminator(type.schema);
  } else if (type instanceof ZodEffects) {
    return getDiscriminator(type.innerType());
  } else if (type instanceof ZodLiteral) {
    return [type.value];
  } else if (type instanceof ZodEnum) {
    return type.options;
  } else if (type instanceof ZodNativeEnum) {
    return util.objectValues(type.enum);
  } else if (type instanceof ZodDefault) {
    return getDiscriminator(type._def.innerType);
  } else if (type instanceof ZodUndefined) {
    return [void 0];
  } else if (type instanceof ZodNull) {
    return [null];
  } else if (type instanceof ZodOptional) {
    return [void 0, ...getDiscriminator(type.unwrap())];
  } else if (type instanceof ZodNullable) {
    return [null, ...getDiscriminator(type.unwrap())];
  } else if (type instanceof ZodBranded) {
    return getDiscriminator(type.unwrap());
  } else if (type instanceof ZodReadonly) {
    return getDiscriminator(type.unwrap());
  } else if (type instanceof ZodCatch) {
    return getDiscriminator(type._def.innerType);
  } else {
    return [];
  }
};
var ZodDiscriminatedUnion = class _ZodDiscriminatedUnion extends ZodType {
  _parse(input) {
    const { ctx } = this._processInputParams(input);
    if (ctx.parsedType !== ZodParsedType.object) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.object,
        received: ctx.parsedType
      });
      return INVALID;
    }
    const discriminator = this.discriminator;
    const discriminatorValue = ctx.data[discriminator];
    const option = this.optionsMap.get(discriminatorValue);
    if (!option) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_union_discriminator,
        options: Array.from(this.optionsMap.keys()),
        path: [discriminator]
      });
      return INVALID;
    }
    if (ctx.common.async) {
      return option._parseAsync({
        data: ctx.data,
        path: ctx.path,
        parent: ctx
      });
    } else {
      return option._parseSync({
        data: ctx.data,
        path: ctx.path,
        parent: ctx
      });
    }
  }
  get discriminator() {
    return this._def.discriminator;
  }
  get options() {
    return this._def.options;
  }
  get optionsMap() {
    return this._def.optionsMap;
  }
  /**
   * The constructor of the discriminated union schema. Its behaviour is very similar to that of the normal z.union() constructor.
   * However, it only allows a union of objects, all of which need to share a discriminator property. This property must
   * have a different value for each object in the union.
   * @param discriminator the name of the discriminator property
   * @param types an array of object schemas
   * @param params
   */
  static create(discriminator, options, params) {
    const optionsMap = /* @__PURE__ */ new Map();
    for (const type of options) {
      const discriminatorValues = getDiscriminator(type.shape[discriminator]);
      if (!discriminatorValues.length) {
        throw new Error(`A discriminator value for key \`${discriminator}\` could not be extracted from all schema options`);
      }
      for (const value of discriminatorValues) {
        if (optionsMap.has(value)) {
          throw new Error(`Discriminator property ${String(discriminator)} has duplicate value ${String(value)}`);
        }
        optionsMap.set(value, type);
      }
    }
    return new _ZodDiscriminatedUnion({
      typeName: ZodFirstPartyTypeKind.ZodDiscriminatedUnion,
      discriminator,
      options,
      optionsMap,
      ...processCreateParams(params)
    });
  }
};
function mergeValues(a, b) {
  const aType = getParsedType(a);
  const bType = getParsedType(b);
  if (a === b) {
    return { valid: true, data: a };
  } else if (aType === ZodParsedType.object && bType === ZodParsedType.object) {
    const bKeys = util.objectKeys(b);
    const sharedKeys = util.objectKeys(a).filter((key) => bKeys.indexOf(key) !== -1);
    const newObj = { ...a, ...b };
    for (const key of sharedKeys) {
      const sharedValue = mergeValues(a[key], b[key]);
      if (!sharedValue.valid) {
        return { valid: false };
      }
      newObj[key] = sharedValue.data;
    }
    return { valid: true, data: newObj };
  } else if (aType === ZodParsedType.array && bType === ZodParsedType.array) {
    if (a.length !== b.length) {
      return { valid: false };
    }
    const newArray = [];
    for (let index = 0; index < a.length; index++) {
      const itemA = a[index];
      const itemB = b[index];
      const sharedValue = mergeValues(itemA, itemB);
      if (!sharedValue.valid) {
        return { valid: false };
      }
      newArray.push(sharedValue.data);
    }
    return { valid: true, data: newArray };
  } else if (aType === ZodParsedType.date && bType === ZodParsedType.date && +a === +b) {
    return { valid: true, data: a };
  } else {
    return { valid: false };
  }
}
var ZodIntersection = class extends ZodType {
  _parse(input) {
    const { status, ctx } = this._processInputParams(input);
    const handleParsed = (parsedLeft, parsedRight) => {
      if (isAborted(parsedLeft) || isAborted(parsedRight)) {
        return INVALID;
      }
      const merged = mergeValues(parsedLeft.value, parsedRight.value);
      if (!merged.valid) {
        addIssueToContext(ctx, {
          code: ZodIssueCode.invalid_intersection_types
        });
        return INVALID;
      }
      if (isDirty(parsedLeft) || isDirty(parsedRight)) {
        status.dirty();
      }
      return { status: status.value, value: merged.data };
    };
    if (ctx.common.async) {
      return Promise.all([
        this._def.left._parseAsync({
          data: ctx.data,
          path: ctx.path,
          parent: ctx
        }),
        this._def.right._parseAsync({
          data: ctx.data,
          path: ctx.path,
          parent: ctx
        })
      ]).then(([left, right]) => handleParsed(left, right));
    } else {
      return handleParsed(this._def.left._parseSync({
        data: ctx.data,
        path: ctx.path,
        parent: ctx
      }), this._def.right._parseSync({
        data: ctx.data,
        path: ctx.path,
        parent: ctx
      }));
    }
  }
};
ZodIntersection.create = (left, right, params) => {
  return new ZodIntersection({
    left,
    right,
    typeName: ZodFirstPartyTypeKind.ZodIntersection,
    ...processCreateParams(params)
  });
};
var ZodTuple = class _ZodTuple extends ZodType {
  _parse(input) {
    const { status, ctx } = this._processInputParams(input);
    if (ctx.parsedType !== ZodParsedType.array) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.array,
        received: ctx.parsedType
      });
      return INVALID;
    }
    if (ctx.data.length < this._def.items.length) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.too_small,
        minimum: this._def.items.length,
        inclusive: true,
        exact: false,
        type: "array"
      });
      return INVALID;
    }
    const rest = this._def.rest;
    if (!rest && ctx.data.length > this._def.items.length) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.too_big,
        maximum: this._def.items.length,
        inclusive: true,
        exact: false,
        type: "array"
      });
      status.dirty();
    }
    const items = [...ctx.data].map((item, itemIndex) => {
      const schema = this._def.items[itemIndex] || this._def.rest;
      if (!schema)
        return null;
      return schema._parse(new ParseInputLazyPath(ctx, item, ctx.path, itemIndex));
    }).filter((x) => !!x);
    if (ctx.common.async) {
      return Promise.all(items).then((results) => {
        return ParseStatus.mergeArray(status, results);
      });
    } else {
      return ParseStatus.mergeArray(status, items);
    }
  }
  get items() {
    return this._def.items;
  }
  rest(rest) {
    return new _ZodTuple({
      ...this._def,
      rest
    });
  }
};
ZodTuple.create = (schemas, params) => {
  if (!Array.isArray(schemas)) {
    throw new Error("You must pass an array of schemas to z.tuple([ ... ])");
  }
  return new ZodTuple({
    items: schemas,
    typeName: ZodFirstPartyTypeKind.ZodTuple,
    rest: null,
    ...processCreateParams(params)
  });
};
var ZodRecord = class _ZodRecord extends ZodType {
  get keySchema() {
    return this._def.keyType;
  }
  get valueSchema() {
    return this._def.valueType;
  }
  _parse(input) {
    const { status, ctx } = this._processInputParams(input);
    if (ctx.parsedType !== ZodParsedType.object) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.object,
        received: ctx.parsedType
      });
      return INVALID;
    }
    const pairs = [];
    const keyType = this._def.keyType;
    const valueType = this._def.valueType;
    for (const key in ctx.data) {
      pairs.push({
        key: keyType._parse(new ParseInputLazyPath(ctx, key, ctx.path, key)),
        value: valueType._parse(new ParseInputLazyPath(ctx, ctx.data[key], ctx.path, key)),
        alwaysSet: key in ctx.data
      });
    }
    if (ctx.common.async) {
      return ParseStatus.mergeObjectAsync(status, pairs);
    } else {
      return ParseStatus.mergeObjectSync(status, pairs);
    }
  }
  get element() {
    return this._def.valueType;
  }
  static create(first, second, third) {
    if (second instanceof ZodType) {
      return new _ZodRecord({
        keyType: first,
        valueType: second,
        typeName: ZodFirstPartyTypeKind.ZodRecord,
        ...processCreateParams(third)
      });
    }
    return new _ZodRecord({
      keyType: ZodString.create(),
      valueType: first,
      typeName: ZodFirstPartyTypeKind.ZodRecord,
      ...processCreateParams(second)
    });
  }
};
var ZodMap = class extends ZodType {
  get keySchema() {
    return this._def.keyType;
  }
  get valueSchema() {
    return this._def.valueType;
  }
  _parse(input) {
    const { status, ctx } = this._processInputParams(input);
    if (ctx.parsedType !== ZodParsedType.map) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.map,
        received: ctx.parsedType
      });
      return INVALID;
    }
    const keyType = this._def.keyType;
    const valueType = this._def.valueType;
    const pairs = [...ctx.data.entries()].map(([key, value], index) => {
      return {
        key: keyType._parse(new ParseInputLazyPath(ctx, key, ctx.path, [index, "key"])),
        value: valueType._parse(new ParseInputLazyPath(ctx, value, ctx.path, [index, "value"]))
      };
    });
    if (ctx.common.async) {
      const finalMap = /* @__PURE__ */ new Map();
      return Promise.resolve().then(async () => {
        for (const pair of pairs) {
          const key = await pair.key;
          const value = await pair.value;
          if (key.status === "aborted" || value.status === "aborted") {
            return INVALID;
          }
          if (key.status === "dirty" || value.status === "dirty") {
            status.dirty();
          }
          finalMap.set(key.value, value.value);
        }
        return { status: status.value, value: finalMap };
      });
    } else {
      const finalMap = /* @__PURE__ */ new Map();
      for (const pair of pairs) {
        const key = pair.key;
        const value = pair.value;
        if (key.status === "aborted" || value.status === "aborted") {
          return INVALID;
        }
        if (key.status === "dirty" || value.status === "dirty") {
          status.dirty();
        }
        finalMap.set(key.value, value.value);
      }
      return { status: status.value, value: finalMap };
    }
  }
};
ZodMap.create = (keyType, valueType, params) => {
  return new ZodMap({
    valueType,
    keyType,
    typeName: ZodFirstPartyTypeKind.ZodMap,
    ...processCreateParams(params)
  });
};
var ZodSet = class _ZodSet extends ZodType {
  _parse(input) {
    const { status, ctx } = this._processInputParams(input);
    if (ctx.parsedType !== ZodParsedType.set) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.set,
        received: ctx.parsedType
      });
      return INVALID;
    }
    const def = this._def;
    if (def.minSize !== null) {
      if (ctx.data.size < def.minSize.value) {
        addIssueToContext(ctx, {
          code: ZodIssueCode.too_small,
          minimum: def.minSize.value,
          type: "set",
          inclusive: true,
          exact: false,
          message: def.minSize.message
        });
        status.dirty();
      }
    }
    if (def.maxSize !== null) {
      if (ctx.data.size > def.maxSize.value) {
        addIssueToContext(ctx, {
          code: ZodIssueCode.too_big,
          maximum: def.maxSize.value,
          type: "set",
          inclusive: true,
          exact: false,
          message: def.maxSize.message
        });
        status.dirty();
      }
    }
    const valueType = this._def.valueType;
    function finalizeSet(elements2) {
      const parsedSet = /* @__PURE__ */ new Set();
      for (const element of elements2) {
        if (element.status === "aborted")
          return INVALID;
        if (element.status === "dirty")
          status.dirty();
        parsedSet.add(element.value);
      }
      return { status: status.value, value: parsedSet };
    }
    const elements = [...ctx.data.values()].map((item, i) => valueType._parse(new ParseInputLazyPath(ctx, item, ctx.path, i)));
    if (ctx.common.async) {
      return Promise.all(elements).then((elements2) => finalizeSet(elements2));
    } else {
      return finalizeSet(elements);
    }
  }
  min(minSize, message) {
    return new _ZodSet({
      ...this._def,
      minSize: { value: minSize, message: errorUtil.toString(message) }
    });
  }
  max(maxSize, message) {
    return new _ZodSet({
      ...this._def,
      maxSize: { value: maxSize, message: errorUtil.toString(message) }
    });
  }
  size(size, message) {
    return this.min(size, message).max(size, message);
  }
  nonempty(message) {
    return this.min(1, message);
  }
};
ZodSet.create = (valueType, params) => {
  return new ZodSet({
    valueType,
    minSize: null,
    maxSize: null,
    typeName: ZodFirstPartyTypeKind.ZodSet,
    ...processCreateParams(params)
  });
};
var ZodFunction = class _ZodFunction extends ZodType {
  constructor() {
    super(...arguments);
    this.validate = this.implement;
  }
  _parse(input) {
    const { ctx } = this._processInputParams(input);
    if (ctx.parsedType !== ZodParsedType.function) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.function,
        received: ctx.parsedType
      });
      return INVALID;
    }
    function makeArgsIssue(args, error) {
      return makeIssue({
        data: args,
        path: ctx.path,
        errorMaps: [ctx.common.contextualErrorMap, ctx.schemaErrorMap, getErrorMap(), en_default].filter((x) => !!x),
        issueData: {
          code: ZodIssueCode.invalid_arguments,
          argumentsError: error
        }
      });
    }
    function makeReturnsIssue(returns, error) {
      return makeIssue({
        data: returns,
        path: ctx.path,
        errorMaps: [ctx.common.contextualErrorMap, ctx.schemaErrorMap, getErrorMap(), en_default].filter((x) => !!x),
        issueData: {
          code: ZodIssueCode.invalid_return_type,
          returnTypeError: error
        }
      });
    }
    const params = { errorMap: ctx.common.contextualErrorMap };
    const fn = ctx.data;
    if (this._def.returns instanceof ZodPromise) {
      const me = this;
      return OK(async function(...args) {
        const error = new ZodError([]);
        const parsedArgs = await me._def.args.parseAsync(args, params).catch((e) => {
          error.addIssue(makeArgsIssue(args, e));
          throw error;
        });
        const result = await Reflect.apply(fn, this, parsedArgs);
        const parsedReturns = await me._def.returns._def.type.parseAsync(result, params).catch((e) => {
          error.addIssue(makeReturnsIssue(result, e));
          throw error;
        });
        return parsedReturns;
      });
    } else {
      const me = this;
      return OK(function(...args) {
        const parsedArgs = me._def.args.safeParse(args, params);
        if (!parsedArgs.success) {
          throw new ZodError([makeArgsIssue(args, parsedArgs.error)]);
        }
        const result = Reflect.apply(fn, this, parsedArgs.data);
        const parsedReturns = me._def.returns.safeParse(result, params);
        if (!parsedReturns.success) {
          throw new ZodError([makeReturnsIssue(result, parsedReturns.error)]);
        }
        return parsedReturns.data;
      });
    }
  }
  parameters() {
    return this._def.args;
  }
  returnType() {
    return this._def.returns;
  }
  args(...items) {
    return new _ZodFunction({
      ...this._def,
      args: ZodTuple.create(items).rest(ZodUnknown.create())
    });
  }
  returns(returnType) {
    return new _ZodFunction({
      ...this._def,
      returns: returnType
    });
  }
  implement(func) {
    const validatedFunc = this.parse(func);
    return validatedFunc;
  }
  strictImplement(func) {
    const validatedFunc = this.parse(func);
    return validatedFunc;
  }
  static create(args, returns, params) {
    return new _ZodFunction({
      args: args ? args : ZodTuple.create([]).rest(ZodUnknown.create()),
      returns: returns || ZodUnknown.create(),
      typeName: ZodFirstPartyTypeKind.ZodFunction,
      ...processCreateParams(params)
    });
  }
};
var ZodLazy = class extends ZodType {
  get schema() {
    return this._def.getter();
  }
  _parse(input) {
    const { ctx } = this._processInputParams(input);
    const lazySchema = this._def.getter();
    return lazySchema._parse({ data: ctx.data, path: ctx.path, parent: ctx });
  }
};
ZodLazy.create = (getter, params) => {
  return new ZodLazy({
    getter,
    typeName: ZodFirstPartyTypeKind.ZodLazy,
    ...processCreateParams(params)
  });
};
var ZodLiteral = class extends ZodType {
  _parse(input) {
    if (input.data !== this._def.value) {
      const ctx = this._getOrReturnCtx(input);
      addIssueToContext(ctx, {
        received: ctx.data,
        code: ZodIssueCode.invalid_literal,
        expected: this._def.value
      });
      return INVALID;
    }
    return { status: "valid", value: input.data };
  }
  get value() {
    return this._def.value;
  }
};
ZodLiteral.create = (value, params) => {
  return new ZodLiteral({
    value,
    typeName: ZodFirstPartyTypeKind.ZodLiteral,
    ...processCreateParams(params)
  });
};
function createZodEnum(values, params) {
  return new ZodEnum({
    values,
    typeName: ZodFirstPartyTypeKind.ZodEnum,
    ...processCreateParams(params)
  });
}
var ZodEnum = class _ZodEnum extends ZodType {
  _parse(input) {
    if (typeof input.data !== "string") {
      const ctx = this._getOrReturnCtx(input);
      const expectedValues = this._def.values;
      addIssueToContext(ctx, {
        expected: util.joinValues(expectedValues),
        received: ctx.parsedType,
        code: ZodIssueCode.invalid_type
      });
      return INVALID;
    }
    if (!this._cache) {
      this._cache = new Set(this._def.values);
    }
    if (!this._cache.has(input.data)) {
      const ctx = this._getOrReturnCtx(input);
      const expectedValues = this._def.values;
      addIssueToContext(ctx, {
        received: ctx.data,
        code: ZodIssueCode.invalid_enum_value,
        options: expectedValues
      });
      return INVALID;
    }
    return OK(input.data);
  }
  get options() {
    return this._def.values;
  }
  get enum() {
    const enumValues = {};
    for (const val of this._def.values) {
      enumValues[val] = val;
    }
    return enumValues;
  }
  get Values() {
    const enumValues = {};
    for (const val of this._def.values) {
      enumValues[val] = val;
    }
    return enumValues;
  }
  get Enum() {
    const enumValues = {};
    for (const val of this._def.values) {
      enumValues[val] = val;
    }
    return enumValues;
  }
  extract(values, newDef = this._def) {
    return _ZodEnum.create(values, {
      ...this._def,
      ...newDef
    });
  }
  exclude(values, newDef = this._def) {
    return _ZodEnum.create(this.options.filter((opt) => !values.includes(opt)), {
      ...this._def,
      ...newDef
    });
  }
};
ZodEnum.create = createZodEnum;
var ZodNativeEnum = class extends ZodType {
  _parse(input) {
    const nativeEnumValues = util.getValidEnumValues(this._def.values);
    const ctx = this._getOrReturnCtx(input);
    if (ctx.parsedType !== ZodParsedType.string && ctx.parsedType !== ZodParsedType.number) {
      const expectedValues = util.objectValues(nativeEnumValues);
      addIssueToContext(ctx, {
        expected: util.joinValues(expectedValues),
        received: ctx.parsedType,
        code: ZodIssueCode.invalid_type
      });
      return INVALID;
    }
    if (!this._cache) {
      this._cache = new Set(util.getValidEnumValues(this._def.values));
    }
    if (!this._cache.has(input.data)) {
      const expectedValues = util.objectValues(nativeEnumValues);
      addIssueToContext(ctx, {
        received: ctx.data,
        code: ZodIssueCode.invalid_enum_value,
        options: expectedValues
      });
      return INVALID;
    }
    return OK(input.data);
  }
  get enum() {
    return this._def.values;
  }
};
ZodNativeEnum.create = (values, params) => {
  return new ZodNativeEnum({
    values,
    typeName: ZodFirstPartyTypeKind.ZodNativeEnum,
    ...processCreateParams(params)
  });
};
var ZodPromise = class extends ZodType {
  unwrap() {
    return this._def.type;
  }
  _parse(input) {
    const { ctx } = this._processInputParams(input);
    if (ctx.parsedType !== ZodParsedType.promise && ctx.common.async === false) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.promise,
        received: ctx.parsedType
      });
      return INVALID;
    }
    const promisified = ctx.parsedType === ZodParsedType.promise ? ctx.data : Promise.resolve(ctx.data);
    return OK(promisified.then((data) => {
      return this._def.type.parseAsync(data, {
        path: ctx.path,
        errorMap: ctx.common.contextualErrorMap
      });
    }));
  }
};
ZodPromise.create = (schema, params) => {
  return new ZodPromise({
    type: schema,
    typeName: ZodFirstPartyTypeKind.ZodPromise,
    ...processCreateParams(params)
  });
};
var ZodEffects = class extends ZodType {
  innerType() {
    return this._def.schema;
  }
  sourceType() {
    return this._def.schema._def.typeName === ZodFirstPartyTypeKind.ZodEffects ? this._def.schema.sourceType() : this._def.schema;
  }
  _parse(input) {
    const { status, ctx } = this._processInputParams(input);
    const effect = this._def.effect || null;
    const checkCtx = {
      addIssue: (arg) => {
        addIssueToContext(ctx, arg);
        if (arg.fatal) {
          status.abort();
        } else {
          status.dirty();
        }
      },
      get path() {
        return ctx.path;
      }
    };
    checkCtx.addIssue = checkCtx.addIssue.bind(checkCtx);
    if (effect.type === "preprocess") {
      const processed = effect.transform(ctx.data, checkCtx);
      if (ctx.common.async) {
        return Promise.resolve(processed).then(async (processed2) => {
          if (status.value === "aborted")
            return INVALID;
          const result = await this._def.schema._parseAsync({
            data: processed2,
            path: ctx.path,
            parent: ctx
          });
          if (result.status === "aborted")
            return INVALID;
          if (result.status === "dirty")
            return DIRTY(result.value);
          if (status.value === "dirty")
            return DIRTY(result.value);
          return result;
        });
      } else {
        if (status.value === "aborted")
          return INVALID;
        const result = this._def.schema._parseSync({
          data: processed,
          path: ctx.path,
          parent: ctx
        });
        if (result.status === "aborted")
          return INVALID;
        if (result.status === "dirty")
          return DIRTY(result.value);
        if (status.value === "dirty")
          return DIRTY(result.value);
        return result;
      }
    }
    if (effect.type === "refinement") {
      const executeRefinement = (acc) => {
        const result = effect.refinement(acc, checkCtx);
        if (ctx.common.async) {
          return Promise.resolve(result);
        }
        if (result instanceof Promise) {
          throw new Error("Async refinement encountered during synchronous parse operation. Use .parseAsync instead.");
        }
        return acc;
      };
      if (ctx.common.async === false) {
        const inner = this._def.schema._parseSync({
          data: ctx.data,
          path: ctx.path,
          parent: ctx
        });
        if (inner.status === "aborted")
          return INVALID;
        if (inner.status === "dirty")
          status.dirty();
        executeRefinement(inner.value);
        return { status: status.value, value: inner.value };
      } else {
        return this._def.schema._parseAsync({ data: ctx.data, path: ctx.path, parent: ctx }).then((inner) => {
          if (inner.status === "aborted")
            return INVALID;
          if (inner.status === "dirty")
            status.dirty();
          return executeRefinement(inner.value).then(() => {
            return { status: status.value, value: inner.value };
          });
        });
      }
    }
    if (effect.type === "transform") {
      if (ctx.common.async === false) {
        const base = this._def.schema._parseSync({
          data: ctx.data,
          path: ctx.path,
          parent: ctx
        });
        if (!isValid(base))
          return INVALID;
        const result = effect.transform(base.value, checkCtx);
        if (result instanceof Promise) {
          throw new Error(`Asynchronous transform encountered during synchronous parse operation. Use .parseAsync instead.`);
        }
        return { status: status.value, value: result };
      } else {
        return this._def.schema._parseAsync({ data: ctx.data, path: ctx.path, parent: ctx }).then((base) => {
          if (!isValid(base))
            return INVALID;
          return Promise.resolve(effect.transform(base.value, checkCtx)).then((result) => ({
            status: status.value,
            value: result
          }));
        });
      }
    }
    util.assertNever(effect);
  }
};
ZodEffects.create = (schema, effect, params) => {
  return new ZodEffects({
    schema,
    typeName: ZodFirstPartyTypeKind.ZodEffects,
    effect,
    ...processCreateParams(params)
  });
};
ZodEffects.createWithPreprocess = (preprocess, schema, params) => {
  return new ZodEffects({
    schema,
    effect: { type: "preprocess", transform: preprocess },
    typeName: ZodFirstPartyTypeKind.ZodEffects,
    ...processCreateParams(params)
  });
};
var ZodOptional = class extends ZodType {
  _parse(input) {
    const parsedType = this._getType(input);
    if (parsedType === ZodParsedType.undefined) {
      return OK(void 0);
    }
    return this._def.innerType._parse(input);
  }
  unwrap() {
    return this._def.innerType;
  }
};
ZodOptional.create = (type, params) => {
  return new ZodOptional({
    innerType: type,
    typeName: ZodFirstPartyTypeKind.ZodOptional,
    ...processCreateParams(params)
  });
};
var ZodNullable = class extends ZodType {
  _parse(input) {
    const parsedType = this._getType(input);
    if (parsedType === ZodParsedType.null) {
      return OK(null);
    }
    return this._def.innerType._parse(input);
  }
  unwrap() {
    return this._def.innerType;
  }
};
ZodNullable.create = (type, params) => {
  return new ZodNullable({
    innerType: type,
    typeName: ZodFirstPartyTypeKind.ZodNullable,
    ...processCreateParams(params)
  });
};
var ZodDefault = class extends ZodType {
  _parse(input) {
    const { ctx } = this._processInputParams(input);
    let data = ctx.data;
    if (ctx.parsedType === ZodParsedType.undefined) {
      data = this._def.defaultValue();
    }
    return this._def.innerType._parse({
      data,
      path: ctx.path,
      parent: ctx
    });
  }
  removeDefault() {
    return this._def.innerType;
  }
};
ZodDefault.create = (type, params) => {
  return new ZodDefault({
    innerType: type,
    typeName: ZodFirstPartyTypeKind.ZodDefault,
    defaultValue: typeof params.default === "function" ? params.default : () => params.default,
    ...processCreateParams(params)
  });
};
var ZodCatch = class extends ZodType {
  _parse(input) {
    const { ctx } = this._processInputParams(input);
    const newCtx = {
      ...ctx,
      common: {
        ...ctx.common,
        issues: []
      }
    };
    const result = this._def.innerType._parse({
      data: newCtx.data,
      path: newCtx.path,
      parent: {
        ...newCtx
      }
    });
    if (isAsync(result)) {
      return result.then((result2) => {
        return {
          status: "valid",
          value: result2.status === "valid" ? result2.value : this._def.catchValue({
            get error() {
              return new ZodError(newCtx.common.issues);
            },
            input: newCtx.data
          })
        };
      });
    } else {
      return {
        status: "valid",
        value: result.status === "valid" ? result.value : this._def.catchValue({
          get error() {
            return new ZodError(newCtx.common.issues);
          },
          input: newCtx.data
        })
      };
    }
  }
  removeCatch() {
    return this._def.innerType;
  }
};
ZodCatch.create = (type, params) => {
  return new ZodCatch({
    innerType: type,
    typeName: ZodFirstPartyTypeKind.ZodCatch,
    catchValue: typeof params.catch === "function" ? params.catch : () => params.catch,
    ...processCreateParams(params)
  });
};
var ZodNaN = class extends ZodType {
  _parse(input) {
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.nan) {
      const ctx = this._getOrReturnCtx(input);
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.nan,
        received: ctx.parsedType
      });
      return INVALID;
    }
    return { status: "valid", value: input.data };
  }
};
ZodNaN.create = (params) => {
  return new ZodNaN({
    typeName: ZodFirstPartyTypeKind.ZodNaN,
    ...processCreateParams(params)
  });
};
var BRAND = Symbol("zod_brand");
var ZodBranded = class extends ZodType {
  _parse(input) {
    const { ctx } = this._processInputParams(input);
    const data = ctx.data;
    return this._def.type._parse({
      data,
      path: ctx.path,
      parent: ctx
    });
  }
  unwrap() {
    return this._def.type;
  }
};
var ZodPipeline = class _ZodPipeline extends ZodType {
  _parse(input) {
    const { status, ctx } = this._processInputParams(input);
    if (ctx.common.async) {
      const handleAsync = async () => {
        const inResult = await this._def.in._parseAsync({
          data: ctx.data,
          path: ctx.path,
          parent: ctx
        });
        if (inResult.status === "aborted")
          return INVALID;
        if (inResult.status === "dirty") {
          status.dirty();
          return DIRTY(inResult.value);
        } else {
          return this._def.out._parseAsync({
            data: inResult.value,
            path: ctx.path,
            parent: ctx
          });
        }
      };
      return handleAsync();
    } else {
      const inResult = this._def.in._parseSync({
        data: ctx.data,
        path: ctx.path,
        parent: ctx
      });
      if (inResult.status === "aborted")
        return INVALID;
      if (inResult.status === "dirty") {
        status.dirty();
        return {
          status: "dirty",
          value: inResult.value
        };
      } else {
        return this._def.out._parseSync({
          data: inResult.value,
          path: ctx.path,
          parent: ctx
        });
      }
    }
  }
  static create(a, b) {
    return new _ZodPipeline({
      in: a,
      out: b,
      typeName: ZodFirstPartyTypeKind.ZodPipeline
    });
  }
};
var ZodReadonly = class extends ZodType {
  _parse(input) {
    const result = this._def.innerType._parse(input);
    const freeze = (data) => {
      if (isValid(data)) {
        data.value = Object.freeze(data.value);
      }
      return data;
    };
    return isAsync(result) ? result.then((data) => freeze(data)) : freeze(result);
  }
  unwrap() {
    return this._def.innerType;
  }
};
ZodReadonly.create = (type, params) => {
  return new ZodReadonly({
    innerType: type,
    typeName: ZodFirstPartyTypeKind.ZodReadonly,
    ...processCreateParams(params)
  });
};
function cleanParams(params, data) {
  const p = typeof params === "function" ? params(data) : typeof params === "string" ? { message: params } : params;
  const p2 = typeof p === "string" ? { message: p } : p;
  return p2;
}
function custom(check, _params = {}, fatal) {
  if (check)
    return ZodAny.create().superRefine((data, ctx) => {
      const r = check(data);
      if (r instanceof Promise) {
        return r.then((r2) => {
          if (!r2) {
            const params = cleanParams(_params, data);
            const _fatal = params.fatal ?? fatal ?? true;
            ctx.addIssue({ code: "custom", ...params, fatal: _fatal });
          }
        });
      }
      if (!r) {
        const params = cleanParams(_params, data);
        const _fatal = params.fatal ?? fatal ?? true;
        ctx.addIssue({ code: "custom", ...params, fatal: _fatal });
      }
      return;
    });
  return ZodAny.create();
}
var late = {
  object: ZodObject.lazycreate
};
var ZodFirstPartyTypeKind;
(function(ZodFirstPartyTypeKind2) {
  ZodFirstPartyTypeKind2["ZodString"] = "ZodString";
  ZodFirstPartyTypeKind2["ZodNumber"] = "ZodNumber";
  ZodFirstPartyTypeKind2["ZodNaN"] = "ZodNaN";
  ZodFirstPartyTypeKind2["ZodBigInt"] = "ZodBigInt";
  ZodFirstPartyTypeKind2["ZodBoolean"] = "ZodBoolean";
  ZodFirstPartyTypeKind2["ZodDate"] = "ZodDate";
  ZodFirstPartyTypeKind2["ZodSymbol"] = "ZodSymbol";
  ZodFirstPartyTypeKind2["ZodUndefined"] = "ZodUndefined";
  ZodFirstPartyTypeKind2["ZodNull"] = "ZodNull";
  ZodFirstPartyTypeKind2["ZodAny"] = "ZodAny";
  ZodFirstPartyTypeKind2["ZodUnknown"] = "ZodUnknown";
  ZodFirstPartyTypeKind2["ZodNever"] = "ZodNever";
  ZodFirstPartyTypeKind2["ZodVoid"] = "ZodVoid";
  ZodFirstPartyTypeKind2["ZodArray"] = "ZodArray";
  ZodFirstPartyTypeKind2["ZodObject"] = "ZodObject";
  ZodFirstPartyTypeKind2["ZodUnion"] = "ZodUnion";
  ZodFirstPartyTypeKind2["ZodDiscriminatedUnion"] = "ZodDiscriminatedUnion";
  ZodFirstPartyTypeKind2["ZodIntersection"] = "ZodIntersection";
  ZodFirstPartyTypeKind2["ZodTuple"] = "ZodTuple";
  ZodFirstPartyTypeKind2["ZodRecord"] = "ZodRecord";
  ZodFirstPartyTypeKind2["ZodMap"] = "ZodMap";
  ZodFirstPartyTypeKind2["ZodSet"] = "ZodSet";
  ZodFirstPartyTypeKind2["ZodFunction"] = "ZodFunction";
  ZodFirstPartyTypeKind2["ZodLazy"] = "ZodLazy";
  ZodFirstPartyTypeKind2["ZodLiteral"] = "ZodLiteral";
  ZodFirstPartyTypeKind2["ZodEnum"] = "ZodEnum";
  ZodFirstPartyTypeKind2["ZodEffects"] = "ZodEffects";
  ZodFirstPartyTypeKind2["ZodNativeEnum"] = "ZodNativeEnum";
  ZodFirstPartyTypeKind2["ZodOptional"] = "ZodOptional";
  ZodFirstPartyTypeKind2["ZodNullable"] = "ZodNullable";
  ZodFirstPartyTypeKind2["ZodDefault"] = "ZodDefault";
  ZodFirstPartyTypeKind2["ZodCatch"] = "ZodCatch";
  ZodFirstPartyTypeKind2["ZodPromise"] = "ZodPromise";
  ZodFirstPartyTypeKind2["ZodBranded"] = "ZodBranded";
  ZodFirstPartyTypeKind2["ZodPipeline"] = "ZodPipeline";
  ZodFirstPartyTypeKind2["ZodReadonly"] = "ZodReadonly";
})(ZodFirstPartyTypeKind || (ZodFirstPartyTypeKind = {}));
var instanceOfType = (cls, params = {
  message: `Input not instance of ${cls.name}`
}) => custom((data) => data instanceof cls, params);
var stringType = ZodString.create;
var numberType = ZodNumber.create;
var nanType = ZodNaN.create;
var bigIntType = ZodBigInt.create;
var booleanType = ZodBoolean.create;
var dateType = ZodDate.create;
var symbolType = ZodSymbol.create;
var undefinedType = ZodUndefined.create;
var nullType = ZodNull.create;
var anyType = ZodAny.create;
var unknownType = ZodUnknown.create;
var neverType = ZodNever.create;
var voidType = ZodVoid.create;
var arrayType = ZodArray.create;
var objectType = ZodObject.create;
var strictObjectType = ZodObject.strictCreate;
var unionType = ZodUnion.create;
var discriminatedUnionType = ZodDiscriminatedUnion.create;
var intersectionType = ZodIntersection.create;
var tupleType = ZodTuple.create;
var recordType = ZodRecord.create;
var mapType = ZodMap.create;
var setType = ZodSet.create;
var functionType = ZodFunction.create;
var lazyType = ZodLazy.create;
var literalType = ZodLiteral.create;
var enumType = ZodEnum.create;
var nativeEnumType = ZodNativeEnum.create;
var promiseType = ZodPromise.create;
var effectsType = ZodEffects.create;
var optionalType = ZodOptional.create;
var nullableType = ZodNullable.create;
var preprocessType = ZodEffects.createWithPreprocess;
var pipelineType = ZodPipeline.create;
var ostring = () => stringType().optional();
var onumber = () => numberType().optional();
var oboolean = () => booleanType().optional();
var coerce = {
  string: ((arg) => ZodString.create({ ...arg, coerce: true })),
  number: ((arg) => ZodNumber.create({ ...arg, coerce: true })),
  boolean: ((arg) => ZodBoolean.create({
    ...arg,
    coerce: true
  })),
  bigint: ((arg) => ZodBigInt.create({ ...arg, coerce: true })),
  date: ((arg) => ZodDate.create({ ...arg, coerce: true }))
};
var NEVER = INVALID;

// dist/schemas/verification.js
var SHELL_BINARIES = /* @__PURE__ */ new Set([
  "sh",
  "bash",
  "zsh",
  "fish",
  "dash",
  "cmd",
  "cmd.exe",
  "powershell",
  "powershell.exe",
  "pwsh",
  "pwsh.exe"
]);
function commandBinaryName(argv0) {
  const normalized = argv0.replaceAll("\\", "/");
  return normalized.slice(normalized.lastIndexOf("/") + 1).toLowerCase();
}
var ProjectRelativeCwd = external_exports.string().min(1).superRefine((cwd, ctx) => {
  if (cwd.startsWith("/") || cwd.startsWith("~") || /^[A-Za-z]:[\\/]/.test(cwd)) {
    ctx.addIssue({
      code: external_exports.ZodIssueCode.custom,
      message: "cwd must be project-relative and cannot use absolute or home paths"
    });
  }
  if (cwd.startsWith("\\\\") || cwd.startsWith("//")) {
    ctx.addIssue({
      code: external_exports.ZodIssueCode.custom,
      message: "cwd must not use UNC or network absolute paths"
    });
  }
  const parts = cwd.split("/");
  if (parts.some((part) => part === "..")) {
    ctx.addIssue({
      code: external_exports.ZodIssueCode.custom,
      message: "cwd must not escape the project root"
    });
  }
  if (cwd !== "." && parts.some((part) => part.length === 0 || part === ".")) {
    ctx.addIssue({
      code: external_exports.ZodIssueCode.custom,
      message: 'cwd must be "." or a normalized project-relative path'
    });
  }
});
var VerificationCommand = external_exports.object({
  id: external_exports.string().min(1),
  cwd: ProjectRelativeCwd,
  argv: external_exports.array(external_exports.string().min(1)).min(1),
  timeout_ms: external_exports.number().int().positive(),
  max_output_bytes: external_exports.number().int().positive(),
  env: external_exports.record(external_exports.string(), external_exports.string())
}).strict().superRefine((command, ctx) => {
  const firstArg = command.argv[0];
  if (firstArg === void 0)
    return;
  const binary = commandBinaryName(firstArg);
  if (SHELL_BINARIES.has(binary)) {
    ctx.addIssue({
      code: external_exports.ZodIssueCode.custom,
      path: ["argv"],
      message: "verification commands must use direct argv execution, not a shell executable"
    });
  }
});
var VerificationCommandResult = external_exports.object({
  command_id: external_exports.string().min(1),
  argv: external_exports.array(external_exports.string().min(1)).min(1),
  cwd: ProjectRelativeCwd,
  exit_code: external_exports.number().int().nonnegative(),
  status: external_exports.enum(["passed", "failed"]),
  duration_ms: external_exports.number().int().nonnegative(),
  stdout_summary: external_exports.string(),
  stderr_summary: external_exports.string()
}).strict().superRefine((result, ctx) => {
  const expected = result.exit_code === 0 ? "passed" : "failed";
  if (result.status !== expected) {
    ctx.addIssue({
      code: external_exports.ZodIssueCode.custom,
      path: ["status"],
      message: `status must be '${expected}' when exit_code is ${result.exit_code}`
    });
  }
});
var VerificationResult = external_exports.object({
  overall_status: external_exports.enum(["passed", "failed"]),
  commands: external_exports.array(VerificationCommandResult).min(1)
}).strict().superRefine((verification, ctx) => {
  const expected = verification.commands.some((command) => command.status === "failed") ? "failed" : "passed";
  if (verification.overall_status !== expected) {
    ctx.addIssue({
      code: external_exports.ZodIssueCode.custom,
      path: ["overall_status"],
      message: `overall_status must be '${expected}' for command results`
    });
  }
});

// dist/flows/build/reports.js
var BUILD_RESULT_SCHEMA_BY_ARTIFACT_ID = {
  "build.brief": "build.brief@v1",
  "build.plan": "build.plan@v1",
  "build.implementation": "build.implementation@v1",
  "build.verification": "build.verification@v1",
  "build.review": "build.review@v1"
};
var NonEmptyStringArray = external_exports.array(external_exports.string().min(1)).min(1);
var BuildCheckpointPointer = external_exports.object({
  request_path: external_exports.string().min(1),
  response_path: external_exports.string().min(1).optional(),
  allowed_choices: NonEmptyStringArray
}).strict();
var BuildBrief = external_exports.object({
  objective: external_exports.string().min(1),
  scope: external_exports.string().min(1),
  success_criteria: NonEmptyStringArray,
  verification_command_candidates: external_exports.array(VerificationCommand).min(1),
  checkpoint: BuildCheckpointPointer
}).strict();
var BuildPlan = external_exports.object({
  objective: external_exports.string().min(1),
  approach: external_exports.string().min(1),
  slices: NonEmptyStringArray,
  verification: external_exports.object({
    commands: external_exports.array(VerificationCommand).min(1)
  }).strict()
}).strict();
var BuildImplementation = external_exports.object({
  verdict: external_exports.literal("accept"),
  summary: external_exports.string().min(1),
  changed_files: external_exports.array(external_exports.string().min(1)),
  evidence: NonEmptyStringArray
}).strict();
var BuildVerification = VerificationResult;
var BuildReviewVerdict = external_exports.enum(["accept", "accept-with-fixes", "reject"]);
var BuildReviewFinding = external_exports.object({
  severity: external_exports.enum(["critical", "high", "medium", "low"]),
  text: external_exports.string().min(1),
  file_refs: external_exports.array(external_exports.string().min(1))
}).strict();
var BuildReview = external_exports.object({
  verdict: BuildReviewVerdict,
  summary: external_exports.string().min(1),
  findings: external_exports.array(BuildReviewFinding)
}).strict().superRefine((review, ctx) => {
  if (review.verdict !== "accept" && review.findings.length === 0) {
    ctx.addIssue({
      code: external_exports.ZodIssueCode.custom,
      path: ["findings"],
      message: `findings must be non-empty when verdict is '${review.verdict}'`
    });
  }
});
var BuildResultReportId = external_exports.enum([
  "build.brief",
  "build.plan",
  "build.implementation",
  "build.verification",
  "build.review"
]);
var BuildResultReportPointer = external_exports.object({
  report_id: BuildResultReportId,
  path: external_exports.string().min(1),
  schema: external_exports.string().min(1)
}).strict().superRefine((pointer, ctx) => {
  const expectedSchema = BUILD_RESULT_SCHEMA_BY_ARTIFACT_ID[pointer.report_id];
  if (pointer.schema !== expectedSchema) {
    ctx.addIssue({
      code: external_exports.ZodIssueCode.custom,
      path: ["schema"],
      message: `schema must be '${expectedSchema}' for report_id '${pointer.report_id}'`
    });
  }
});
var BuildResult = external_exports.object({
  summary: external_exports.string().min(1),
  outcome: external_exports.enum(["complete", "needs_attention", "failed"]),
  verification_status: external_exports.enum(["passed", "failed"]),
  review_verdict: BuildReviewVerdict,
  evidence_links: external_exports.array(BuildResultReportPointer).length(5)
}).strict().superRefine((result, ctx) => {
  const seen = /* @__PURE__ */ new Set();
  for (const [index, pointer] of result.evidence_links.entries()) {
    if (seen.has(pointer.report_id)) {
      ctx.addIssue({
        code: external_exports.ZodIssueCode.custom,
        path: ["evidence_links", index, "report_id"],
        message: `duplicate report_id '${pointer.report_id}'`
      });
    }
    seen.add(pointer.report_id);
  }
  for (const reportId of BuildResultReportId.options) {
    if (!seen.has(reportId)) {
      ctx.addIssue({
        code: external_exports.ZodIssueCode.custom,
        path: ["evidence_links"],
        message: `missing report_id '${reportId}'`
      });
    }
  }
  if (result.outcome === "complete") {
    if (result.verification_status !== "passed") {
      ctx.addIssue({
        code: external_exports.ZodIssueCode.custom,
        path: ["verification_status"],
        message: "verification_status must be 'passed' when outcome is 'complete'"
      });
    }
    if (result.review_verdict !== "accept") {
      ctx.addIssue({
        code: external_exports.ZodIssueCode.custom,
        path: ["review_verdict"],
        message: "review_verdict must be 'accept' when outcome is 'complete'"
      });
    }
  }
  if (result.outcome === "needs_attention") {
    if (result.verification_status !== "passed") {
      ctx.addIssue({
        code: external_exports.ZodIssueCode.custom,
        path: ["verification_status"],
        message: "verification_status must be 'passed' when outcome is 'needs_attention'"
      });
    }
    if (result.review_verdict !== "accept-with-fixes") {
      ctx.addIssue({
        code: external_exports.ZodIssueCode.custom,
        path: ["review_verdict"],
        message: "review_verdict must be 'accept-with-fixes' when outcome is 'needs_attention'"
      });
    }
  }
});

// dist/flows/build/writers/checkpoint-brief.js
import { readFileSync } from "node:fs";

// dist/shared/connector-relay.js
import { createHash } from "node:crypto";
function sha256Hex(payload) {
  return createHash("sha256").update(payload, "utf8").digest("hex");
}

// dist/shared/run-relative-path.js
import { existsSync, lstatSync, realpathSync } from "node:fs";
import { isAbsolute, relative, resolve } from "node:path";

// dist/schemas/scalars.js
var ControlPlaneFileStem = external_exports.string().min(1).max(128).regex(/^[a-z0-9][a-z0-9._-]*$/, {
  message: "must match /^[a-z0-9][a-z0-9._-]*$/ (lowercase alnum start; alnum, dot, underscore, hyphen thereafter)"
}).refine((value) => value !== "." && value !== "..", {
  message: "must not be a current or parent directory segment"
}).refine((value) => !value.includes(".."), {
  message: "must not contain parent-directory traversal"
}).refine((value) => !value.includes("/") && !value.includes("\\"), {
  message: "must not contain path separators"
});
var RunRelativePath = external_exports.string().min(1, { message: "run-relative path must be non-empty" }).refine((value) => !value.startsWith("/"), {
  message: "run-relative path must not be absolute"
}).refine((value) => !value.includes("\\"), {
  message: 'run-relative path must use POSIX "/" separators, not backslashes'
}).refine((value) => !value.includes(":"), {
  message: "run-relative path must not contain drive-letter or colon forms"
}).refine((value) => value.split("/").every((segment) => segment.length > 0 && segment !== "." && segment !== ".."), {
  message: "run-relative path must not contain empty, current-directory, or parent-directory segments"
}).brand();

// dist/shared/run-relative-path.js
function isInside(root, target) {
  const fromRoot = relative(root, target);
  return fromRoot !== "" && !fromRoot.startsWith("..") && !isAbsolute(fromRoot);
}
function resolveRunRelative(runFolder, relPath) {
  const parsed = RunRelativePath.safeParse(relPath);
  if (!parsed.success) {
    const detail = parsed.error.issues.map((issue) => issue.message).join("; ");
    throw new Error(`run-relative path rejected: ${JSON.stringify(relPath)} (${detail})`);
  }
  const rootAbs = resolve(runFolder);
  const targetAbs = resolve(rootAbs, parsed.data);
  if (!isInside(rootAbs, targetAbs)) {
    throw new Error(`run-relative path rejected: ${JSON.stringify(relPath)} escapes run folder`);
  }
  if (!existsSync(rootAbs))
    return targetAbs;
  const rootReal = realpathSync.native(rootAbs);
  let cursor = rootAbs;
  for (const segment of parsed.data.split("/")) {
    cursor = resolve(cursor, segment);
    if (!existsSync(cursor))
      break;
    const stat2 = lstatSync(cursor);
    if (stat2.isSymbolicLink()) {
      throw new Error(`run-relative path rejected: ${JSON.stringify(relPath)} crosses symlink ${JSON.stringify(cursor)}`);
    }
    const cursorReal = realpathSync.native(cursor);
    if (!isInside(rootReal, cursorReal)) {
      throw new Error(`run-relative path rejected: ${JSON.stringify(relPath)} escapes real run folder through ${JSON.stringify(cursor)}`);
    }
  }
  return targetAbs;
}

// dist/flows/registries/checkpoint-writers/types.js
function checkpointChoiceIds(step) {
  return step.policy.choices.map((choice) => choice.id);
}

// dist/flows/build/writers/checkpoint-brief.js
var BuildBriefReportTemplate = external_exports.object({
  scope: external_exports.string().min(1),
  success_criteria: external_exports.array(external_exports.string().min(1)).min(1),
  verification_command_candidates: external_exports.array(VerificationCommand).min(1)
}).strict();
var buildBriefCheckpointBuilder = {
  resultSchemaName: "build.brief@v1",
  build(context) {
    const rawTemplate = context.step.policy.report_template;
    if (rawTemplate === void 0) {
      throw new Error(`checkpoint step '${context.step.id}' writing build.brief@v1 requires policy.report_template`);
    }
    const template = BuildBriefReportTemplate.parse(rawTemplate);
    return BuildBrief.parse({
      objective: context.goal,
      scope: template.scope,
      success_criteria: template.success_criteria,
      verification_command_candidates: template.verification_command_candidates,
      checkpoint: {
        request_path: context.step.writes.request,
        response_path: context.responsePath,
        allowed_choices: checkpointChoiceIds(context.step)
      }
    });
  },
  validateResumeContext(context) {
    const reportAbs = resolveRunRelative(context.runFolder, context.reportPath);
    const raw = readFileSync(reportAbs, "utf8");
    if (context.reportSha256 === void 0) {
      throw new Error("checkpoint resume rejected: checkpoint request is missing checkpoint_report_sha256");
    }
    const observedHash = sha256Hex(raw);
    if (observedHash !== context.reportSha256) {
      throw new Error("checkpoint resume rejected: waiting Build brief hash differs from request");
    }
    const brief = BuildBrief.parse(JSON.parse(raw));
    const expectedChoices = checkpointChoiceIds(context.step);
    if (brief.checkpoint.request_path !== context.step.writes.request || brief.checkpoint.response_path !== context.step.writes.response || brief.checkpoint.allowed_choices.length !== expectedChoices.length || brief.checkpoint.allowed_choices.some((choice, index) => choice !== expectedChoices[index])) {
      throw new Error(`checkpoint resume rejected: waiting Build brief does not belong to checkpoint '${context.step.id}'`);
    }
    return brief;
  }
};

// dist/flows/registries/close-writers/shared.js
function reportPathForSchemaInCompiledFlow(flow, schemaName) {
  const matches = flow.steps.filter((candidate) => "report" in candidate.writes && candidate.writes.report?.schema === schemaName);
  if (matches.length !== 1) {
    throw new Error(`report schema '${schemaName}' must be written by exactly one flow step, found ${matches.length}`);
  }
  const match = matches[0];
  if (match === void 0) {
    throw new Error(`report schema '${schemaName}' matched no flow step`);
  }
  const report = "report" in match.writes ? match.writes.report : void 0;
  if (report === void 0) {
    throw new Error(`report schema '${schemaName}' matched a step without an report writer`);
  }
  return report.path;
}
function flowHasReportSchemaInCompiledFlow(flow, schemaName) {
  return flow.steps.some((candidate) => "report" in candidate.writes && candidate.writes.report?.schema === schemaName);
}

// dist/flows/build/writers/close.js
var POINTERS = [
  { report_id: "build.brief", schema: "build.brief@v1" },
  { report_id: "build.plan", schema: "build.plan@v1" },
  { report_id: "build.implementation", schema: "build.implementation@v1" },
  { report_id: "build.verification", schema: "build.verification@v1" },
  { report_id: "build.review", schema: "build.review@v1" }
];
var buildCloseBuilder = {
  resultSchemaName: "build.result@v1",
  reads: [
    { name: "brief", schema: "build.brief@v1", required: true },
    { name: "plan", schema: "build.plan@v1", required: true },
    { name: "implementation", schema: "build.implementation@v1", required: true },
    { name: "verification", schema: "build.verification@v1", required: true },
    { name: "review", schema: "build.review@v1", required: true }
  ],
  build(context) {
    const brief = BuildBrief.parse(context.inputs.brief);
    BuildPlan.parse(context.inputs.plan);
    const implementation = BuildImplementation.parse(context.inputs.implementation);
    const verification = BuildVerification.parse(context.inputs.verification);
    const review = BuildReview.parse(context.inputs.review);
    const outcome = verification.overall_status !== "passed" ? "failed" : review.verdict === "accept" ? "complete" : review.verdict === "accept-with-fixes" ? "needs_attention" : "failed";
    return BuildResult.parse({
      summary: `Build result for ${brief.objective}: ${implementation.summary}`,
      outcome,
      verification_status: verification.overall_status,
      review_verdict: review.verdict,
      evidence_links: POINTERS.map((p) => ({
        ...p,
        path: reportPathForSchemaInCompiledFlow(context.flow, p.schema)
      }))
    });
  }
};

// dist/flows/build/writers/plan.js
var buildPlanComposeBuilder = {
  resultSchemaName: "build.plan@v1",
  reads: [{ name: "brief", schema: "build.brief@v1", required: true }],
  build(context) {
    const brief = BuildBrief.parse(context.inputs.brief);
    return BuildPlan.parse({
      objective: brief.objective,
      approach: `Make the smallest safe change inside scope: ${brief.scope}`,
      slices: brief.success_criteria.map((criterion) => `Satisfy: ${criterion}`),
      verification: {
        commands: brief.verification_command_candidates
      }
    });
  }
};

// dist/flows/build/writers/verification.js
import { readFileSync as readFileSync2 } from "node:fs";
var buildVerificationWriter = {
  resultSchemaName: "build.verification@v1",
  loadCommands(context) {
    const planPath = reportPathForSchemaInCompiledFlow(context.flow, "build.plan@v1");
    if (!context.step.reads.includes(planPath)) {
      throw new Error(`build.verification@v1 requires step '${context.step.id}' to read ${planPath}`);
    }
    const plan = BuildPlan.parse(JSON.parse(readFileSync2(resolveRunRelative(context.runFolder, planPath), "utf8")));
    return plan.verification.commands;
  },
  buildResult(observations) {
    const overallStatus = observations.some((o) => o.status === "failed") ? "failed" : "passed";
    return BuildVerification.parse({
      overall_status: overallStatus,
      commands: observations.map((o) => ({
        command_id: o.command.id,
        argv: o.command.argv,
        cwd: o.command.cwd,
        exit_code: o.exit_code,
        status: o.status,
        duration_ms: o.duration_ms,
        stdout_summary: o.stdout_summary,
        stderr_summary: o.stderr_summary
      }))
    });
  }
};

// dist/flows/build/index.js
var BUILD_SIGNALS = [
  { label: "develop prefix", pattern: /^\s*develop\s*:/i },
  {
    label: "build implementation request",
    pattern: /^\s*(?:please\s+)?(?:build|implement|develop|add|create|ship)\s+(?:a\s+|an\s+|the\s+|this\s+|that\s+)?(?:new\s+|missing\s+)?(?:feature|change|fix|implementation|endpoint|component|command|tool|integration|helper|export|function|method|behavior)\b/i
  },
  {
    label: "missing implementation request",
    pattern: /^\s*(?:please\s+)?(?:add|implement|create|ship)\s+(?:the\s+)?missing\s+(?:[\w.-]+\s+)?(?:helper|export|function|method|component|command|endpoint|behavior)\b/i
  },
  {
    label: "test-passing implementation request",
    pattern: /^\s*(?:please\s+)?(?:add|implement|create|ship|make)\b.*\b(?:helper|export|function|method|component|command|endpoint|behavior)\b.*\b(?:test|tests|check|build|verification)\b.*\b(?:pass|passes|green)\b/i
  },
  {
    label: "make change request",
    pattern: /^\s*(?:please\s+)?make\s+(?:a\s+|the\s+|this\s+|that\s+)?(?:focused\s+)?change\b/i
  }
];
var buildCompiledFlowPackage = {
  id: "build",
  visibility: "public",
  paths: {
    schematic: "src/flows/build/schematic.json",
    command: "src/flows/build/command.md",
    contract: "src/flows/build/contract.md"
  },
  routing: {
    order: 30,
    signals: BUILD_SIGNALS,
    skipOnPlanningReport: true,
    reasonForMatch(signal) {
      return `matched ${signal.label}; routed to implementation Build flow`;
    }
  },
  relayReports: [
    {
      schemaName: "build.implementation@v1",
      schema: BuildImplementation,
      relayHint: buildImplementationShapeHint.instruction
    },
    {
      schemaName: "build.review@v1",
      schema: BuildReview,
      relayHint: buildReviewShapeHint.instruction
    }
  ],
  reportSchemas: [
    { schemaName: "build.brief@v1", schema: BuildBrief },
    { schemaName: "build.plan@v1", schema: BuildPlan },
    { schemaName: "build.verification@v1", schema: BuildVerification },
    { schemaName: "build.result@v1", schema: BuildResult }
  ],
  writers: {
    compose: [buildPlanComposeBuilder],
    close: [buildCloseBuilder],
    verification: [buildVerificationWriter],
    checkpoint: [buildBriefCheckpointBuilder]
  },
  engineFlags: {
    bindsExecutionDepthToRelaySelection: true
  }
};

// dist/flows/explore/relay-hints.js
var exploreComposeShapeHint = {
  kind: "schema",
  schema: "explore.compose@v1",
  instruction: [
    "Respond with a single raw JSON object whose top-level shape is exactly:",
    '{ "verdict": "<one-of-accepted-verdicts>", "subject": "<subject investigated>", "recommendation": "<primary conclusion or recommendation>", "success_condition_alignment": "<how the recommendation satisfies the brief success condition>", "supporting_aspects": [{ "aspect": "<analysis aspect name>", "contribution": "<how this aspect supports the recommendation>", "evidence_refs": ["<report path or file:line reference that supports this contribution>"] }] }',
    "Ground claims in the provided reports or files you inspect. If the evidence is thin, say so in the recommendation instead of inventing certainty. When asked to score or grade, include the rubric in the recommendation and cite the evidence refs behind the score.",
    "Do not include extra top-level keys. Do not wrap the JSON in Markdown code fences. Do not include any prose before or after the JSON object.",
    "The runtime parses your response with JSON.parse, rejects any verdict not drawn from the accepted-verdicts list, and validates the full report body against explore.compose@v1 before writing reports/compose.json."
  ].join(" ")
};
var exploreReviewVerdictShapeHint = {
  kind: "schema",
  schema: "explore.review-verdict@v1",
  instruction: [
    "Respond with a single raw JSON object whose top-level shape is exactly:",
    '{ "verdict": "<one-of-accepted-verdicts>", "overall_assessment": "<review summary>", "objections": ["<blocking or follow-up objection>"], "missed_angles": ["<important angle not covered>"] }',
    "Use empty arrays when there are no objections or missed angles. Do not include extra top-level keys. Do not wrap the JSON in Markdown code fences. Do not include any prose before or after the JSON object.",
    `Audit the compose against the brief on these axes before deciding the verdict. Subject fidelity: the subject must match the brief; flag if it includes unrelated topics. Evidence groundedness: every evidence_ref must be a real path in the run; flag fabricated, missing, or unresolvable references. Internal consistency: the recommendation and supporting_aspects must not contradict each other or the verdict; flag self-negating or contradictory sentences. Epistemic calibration: confidence must match the evidence; flag overclaiming, false certainty, or assertions unsupported by the cited reports. Success-condition alignment: the success_condition_alignment field must substantively explain how the recommendation satisfies the brief's success condition with specifics from the analysis; flag if it is generic, formulaic, vacuous, merely restates the brief, or could be pasted into any other compose unchanged ("This satisfies the brief." is the canonical failure).`,
    "The runtime parses your response with JSON.parse, rejects any verdict not drawn from the accepted-verdicts list, and validates the full report body against explore.review-verdict@v1 before writing reports/review-verdict.json."
  ].join(" ")
};
var exploreTournamentProposalShapeHint = {
  kind: "schema",
  schema: "explore.tournament-proposal@v1",
  instruction: [
    "Respond with a single raw JSON object whose top-level shape is exactly:",
    '{ "verdict": "accept", "option_id": "<option-1-through-option-4>", "option_label": "<option label>", "case_summary": "<strongest case for this option>", "assumptions": ["<assumption>"], "evidence_refs": ["<report path or file:line reference>"], "risks": ["<risk>"], "next_action": "<next action if this option is selected>" }',
    "Argue for the option named in the branch title. Set option_id to the branch option id named in the step id and title. Do not compare every option; make the strongest evidence-backed case for this branch. Do not include extra top-level keys. Do not wrap the JSON in Markdown code fences. Do not include prose before or after the JSON object.",
    "The runtime parses your response with JSON.parse and validates the full report body against explore.tournament-proposal@v1 before writing the branch report."
  ].join(" ")
};
var exploreTournamentReviewShapeHint = {
  kind: "schema",
  schema: "explore.tournament-review@v1",
  instruction: [
    "Respond with a single raw JSON object whose top-level shape is exactly:",
    '{ "verdict": "<recommend|no-clear-winner|needs-operator>", "recommended_option_id": "<option-1-through-option-4>", "comparison": "<comparative assessment>", "objections": ["<objection>"], "missing_evidence": ["<missing evidence>"], "tradeoff_question": "<specific choice the operator must make>", "confidence": "<low|medium|high>" }',
    "Use the proposal aggregate and source reports. Treat this as the stress review inside the Decision stage, not as a separate canonical Review stage. Do not include extra top-level keys. Do not wrap the JSON in Markdown code fences.",
    "The runtime parses your response with JSON.parse and validates the full report body against explore.tournament-review@v1 before writing reports/tournament-review.json."
  ].join(" ")
};

// dist/flows/explore/reports.js
var EXPLORE_RESULT_SCHEMA_BY_ARTIFACT_ID = {
  "explore.brief": "explore.brief@v1",
  "explore.analysis": "explore.analysis@v1",
  "explore.compose": "explore.compose@v1",
  "explore.review-verdict": "explore.review-verdict@v1",
  "explore.decision-options": "explore.decision-options@v1",
  "explore.tournament-aggregate": "explore.tournament-aggregate@v1",
  "explore.tournament-review": "explore.tournament-review@v1",
  "explore.decision": "explore.decision@v1"
};
var DEFAULT_RESULT_REPORT_IDS = [
  "explore.brief",
  "explore.analysis",
  "explore.compose",
  "explore.review-verdict"
];
var TOURNAMENT_RESULT_REPORT_IDS = [
  "explore.brief",
  "explore.analysis",
  "explore.decision-options",
  "explore.tournament-aggregate",
  "explore.tournament-review",
  "explore.decision"
];
var ExploreBrief = external_exports.object({
  subject: external_exports.string().min(1),
  task: external_exports.string().min(1),
  success_condition: external_exports.string().min(1)
}).strict();
var ExploreEvidenceCitation = external_exports.object({
  source: external_exports.string().min(1),
  summary: external_exports.string().min(1)
}).strict();
var ExploreAspect = external_exports.object({
  name: external_exports.string().min(1),
  summary: external_exports.string().min(1),
  evidence: external_exports.array(ExploreEvidenceCitation).min(1)
}).strict();
var ExploreAnalysis = external_exports.object({
  subject: external_exports.string().min(1),
  aspects: external_exports.array(ExploreAspect).min(1)
}).strict();
var ExploreComposeAspect = external_exports.object({
  aspect: external_exports.string().min(1),
  contribution: external_exports.string().min(1),
  evidence_refs: external_exports.array(external_exports.string().min(1)).min(1)
}).strict();
var ExploreCompose = external_exports.object({
  verdict: external_exports.string().min(1),
  subject: external_exports.string().min(1),
  recommendation: external_exports.string().min(1),
  success_condition_alignment: external_exports.string().min(1),
  supporting_aspects: external_exports.array(ExploreComposeAspect).min(1)
}).strict();
var ExploreReviewVerdictValue = external_exports.enum(["accept", "accept-with-fold-ins"]);
var ExploreReviewVerdict = external_exports.object({
  verdict: ExploreReviewVerdictValue,
  overall_assessment: external_exports.string().min(1),
  objections: external_exports.array(external_exports.string().min(1)),
  missed_angles: external_exports.array(external_exports.string().min(1))
}).strict();
var ExploreReviewFoldIns = external_exports.object({
  overall_assessment: external_exports.string().min(1),
  objections: external_exports.array(external_exports.string().min(1)),
  missed_angles: external_exports.array(external_exports.string().min(1))
}).strict();
var ExploreDecisionOptionId = external_exports.string().regex(/^option-[1-4]$/, { message: "option id must be option-1 through option-4" });
var ExploreDecisionOption = external_exports.object({
  id: ExploreDecisionOptionId,
  label: external_exports.string().min(1),
  summary: external_exports.string().min(1),
  best_case_prompt: external_exports.string().min(1),
  evidence_refs: external_exports.array(external_exports.string().min(1)).min(1),
  tradeoffs: external_exports.array(external_exports.string().min(1)).min(1)
}).strict();
var ExploreDecisionOptions = external_exports.object({
  decision_question: external_exports.string().min(1),
  options: external_exports.array(ExploreDecisionOption).min(2).max(4),
  recommendation_basis: external_exports.string().min(1)
}).strict().superRefine((report, ctx) => {
  const seen = /* @__PURE__ */ new Set();
  for (const [index, option] of report.options.entries()) {
    if (seen.has(option.id)) {
      ctx.addIssue({
        code: external_exports.ZodIssueCode.custom,
        path: ["options", index, "id"],
        message: `duplicate option id '${option.id}'`
      });
    }
    seen.add(option.id);
  }
});
var ExploreTournamentProposal = external_exports.object({
  verdict: external_exports.literal("accept"),
  option_id: ExploreDecisionOptionId,
  option_label: external_exports.string().min(1),
  case_summary: external_exports.string().min(1),
  assumptions: external_exports.array(external_exports.string().min(1)),
  evidence_refs: external_exports.array(external_exports.string().min(1)).min(1),
  risks: external_exports.array(external_exports.string().min(1)),
  next_action: external_exports.string().min(1)
}).strict();
var ExploreTournamentAggregateBranch = external_exports.object({
  branch_id: ExploreDecisionOptionId,
  child_run_id: external_exports.string().min(1),
  child_outcome: external_exports.enum(["complete", "aborted", "handoff", "stopped", "escalated"]),
  verdict: external_exports.string().min(1),
  admitted: external_exports.boolean(),
  result_path: external_exports.string().min(1),
  duration_ms: external_exports.number().nonnegative(),
  result_body: ExploreTournamentProposal.optional()
}).strict();
var ExploreTournamentAggregate = external_exports.object({
  schema_version: external_exports.literal(1),
  join_policy: external_exports.literal("aggregate-only"),
  branch_count: external_exports.number().int().positive(),
  branches: external_exports.array(ExploreTournamentAggregateBranch).min(1)
}).strict().superRefine((aggregate, ctx) => {
  if (aggregate.branch_count !== aggregate.branches.length) {
    ctx.addIssue({
      code: external_exports.ZodIssueCode.custom,
      path: ["branch_count"],
      message: "branch_count must match branches.length"
    });
  }
  for (const [index, branch] of aggregate.branches.entries()) {
    if (branch.child_outcome === "complete" && branch.result_body === void 0) {
      ctx.addIssue({
        code: external_exports.ZodIssueCode.custom,
        path: ["branches", index, "result_body"],
        message: "complete tournament branches must include result_body provenance"
      });
    }
    if (branch.child_outcome === "complete" && branch.result_body !== void 0 && branch.result_body.option_id !== branch.branch_id) {
      ctx.addIssue({
        code: external_exports.ZodIssueCode.custom,
        path: ["branches", index, "result_body", "option_id"],
        message: `branch_id '${branch.branch_id}' must match result_body.option_id '${branch.result_body.option_id}'`
      });
    }
  }
});
var ExploreTournamentReviewVerdict = external_exports.enum([
  "recommend",
  "no-clear-winner",
  "needs-operator"
]);
var ExploreTournamentReview = external_exports.object({
  verdict: ExploreTournamentReviewVerdict,
  recommended_option_id: ExploreDecisionOptionId,
  comparison: external_exports.string().min(1),
  objections: external_exports.array(external_exports.string().min(1)),
  missing_evidence: external_exports.array(external_exports.string().min(1)),
  tradeoff_question: external_exports.string().min(1),
  confidence: external_exports.enum(["low", "medium", "high"])
}).strict();
var ExploreDecisionRejectedOption = external_exports.object({
  option_id: ExploreDecisionOptionId,
  reason: external_exports.string().min(1)
}).strict();
var ExploreDecision = external_exports.object({
  verdict: external_exports.literal("decided"),
  decision_question: external_exports.string().min(1),
  selected_option_id: ExploreDecisionOptionId,
  selected_option_label: external_exports.string().min(1),
  decision: external_exports.string().min(1),
  rationale: external_exports.string().min(1),
  rejected_options: external_exports.array(ExploreDecisionRejectedOption),
  evidence_links: external_exports.array(external_exports.string().min(1)).min(1),
  assumptions: external_exports.array(external_exports.string().min(1)),
  residual_risks: external_exports.array(external_exports.string().min(1)),
  next_action: external_exports.string().min(1),
  follow_up_workflow: external_exports.string().min(1)
}).strict();
var ExploreResultReportId = external_exports.enum([
  "explore.brief",
  "explore.analysis",
  "explore.compose",
  "explore.review-verdict",
  "explore.decision-options",
  "explore.tournament-aggregate",
  "explore.tournament-review",
  "explore.decision"
]);
var ExploreResultReportPointer = external_exports.object({
  report_id: ExploreResultReportId,
  path: external_exports.string().min(1),
  schema: external_exports.string().min(1)
}).strict().superRefine((pointer, ctx) => {
  const expectedSchema = EXPLORE_RESULT_SCHEMA_BY_ARTIFACT_ID[pointer.report_id];
  if (pointer.schema !== expectedSchema) {
    ctx.addIssue({
      code: external_exports.ZodIssueCode.custom,
      path: ["schema"],
      message: `schema must be '${expectedSchema}' for report_id '${pointer.report_id}'`
    });
  }
});
var ExploreDefaultResultVerdictSnapshot = external_exports.object({
  compose_verdict: external_exports.string().min(1),
  review_verdict: ExploreReviewVerdictValue,
  objection_count: external_exports.number().int().nonnegative(),
  missed_angle_count: external_exports.number().int().nonnegative()
}).strict();
var ExploreTournamentResultVerdictSnapshot = external_exports.object({
  decision_verdict: external_exports.literal("decided"),
  tournament_review_verdict: ExploreTournamentReviewVerdict,
  selected_option_id: ExploreDecisionOptionId,
  objection_count: external_exports.number().int().nonnegative(),
  missing_evidence_count: external_exports.number().int().nonnegative()
}).strict();
var ExploreResultVerdictSnapshot = external_exports.union([
  ExploreDefaultResultVerdictSnapshot,
  ExploreTournamentResultVerdictSnapshot
]);
function refineExploreEvidenceLinks(result, ctx, expectedReportIds) {
  const seen = /* @__PURE__ */ new Set();
  for (const [index, pointer] of result.evidence_links.entries()) {
    if (seen.has(pointer.report_id)) {
      ctx.addIssue({
        code: external_exports.ZodIssueCode.custom,
        path: ["evidence_links", index, "report_id"],
        message: `duplicate report_id '${pointer.report_id}'`
      });
    }
    seen.add(pointer.report_id);
  }
  const matchesSet = result.evidence_links.length === expectedReportIds.length && expectedReportIds.every((reportId) => seen.has(reportId));
  if (!matchesSet) {
    ctx.addIssue({
      code: external_exports.ZodIssueCode.custom,
      path: ["evidence_links"],
      message: `evidence_links must contain exactly: ${expectedReportIds.join(", ")}`
    });
  }
}
var ExploreDefaultResult = external_exports.object({
  summary: external_exports.string().min(1),
  verdict_snapshot: ExploreDefaultResultVerdictSnapshot,
  review_fold_ins: ExploreReviewFoldIns.optional(),
  evidence_links: external_exports.array(ExploreResultReportPointer).min(1)
}).strict().superRefine((result, ctx) => {
  refineExploreEvidenceLinks(result, ctx, DEFAULT_RESULT_REPORT_IDS);
  const snapshot = result.verdict_snapshot;
  const requiresFoldIns = snapshot.review_verdict === "accept-with-fold-ins" || snapshot.objection_count > 0 || snapshot.missed_angle_count > 0;
  if (requiresFoldIns && result.review_fold_ins === void 0) {
    ctx.addIssue({
      code: external_exports.ZodIssueCode.custom,
      path: ["review_fold_ins"],
      message: "review_fold_ins is required when the default Explore review verdict or counts report fold-ins"
    });
  }
  const foldIns = result.review_fold_ins;
  if (foldIns === void 0)
    return;
  if (foldIns.objections.length !== snapshot.objection_count) {
    ctx.addIssue({
      code: external_exports.ZodIssueCode.custom,
      path: ["review_fold_ins", "objections"],
      message: "review_fold_ins.objections length must match verdict_snapshot.objection_count"
    });
  }
  if (foldIns.missed_angles.length !== snapshot.missed_angle_count) {
    ctx.addIssue({
      code: external_exports.ZodIssueCode.custom,
      path: ["review_fold_ins", "missed_angles"],
      message: "review_fold_ins.missed_angles length must match verdict_snapshot.missed_angle_count"
    });
  }
});
var ExploreTournamentResult = external_exports.object({
  summary: external_exports.string().min(1),
  verdict_snapshot: ExploreTournamentResultVerdictSnapshot,
  evidence_links: external_exports.array(ExploreResultReportPointer).min(1)
}).strict().superRefine((result, ctx) => {
  refineExploreEvidenceLinks(result, ctx, TOURNAMENT_RESULT_REPORT_IDS);
});
var ExploreResult = external_exports.union([ExploreDefaultResult, ExploreTournamentResult]);

// dist/flows/explore/writers/analysis.js
var exploreAnalysisComposeBuilder = {
  resultSchemaName: "explore.analysis@v1",
  reads: [{ name: "brief", schema: "explore.brief@v1", required: true }],
  build(context) {
    const brief = ExploreBrief.parse(context.inputs.brief);
    const briefPath = context.step.reads.find((path) => path.endsWith("brief.json"));
    if (briefPath === void 0) {
      throw new Error(`explore.analysis@v1 requires step '${context.step.id}' to read the brief report`);
    }
    return ExploreAnalysis.parse({
      subject: brief.subject,
      aspects: [
        {
          name: "task-framing",
          summary: `Frame the concrete question, decision shape, and useful answer boundary for: ${brief.task}`,
          evidence: [
            {
              source: briefPath,
              summary: brief.success_condition
            }
          ]
        },
        {
          name: "evidence-targets",
          summary: "Identify the repo files, reports, commands, or run evidence that would prove the answer, and call out any evidence still missing.",
          evidence: [
            {
              source: briefPath,
              summary: "Evidence target: cite inspected files, reports, commands, or run evidence before treating claims as confirmed."
            }
          ]
        },
        {
          name: "risk-and-constraints",
          summary: "Separate confirmed facts from assumptions, then name likely risk areas, constraints, and follow-up proof needed before execution.",
          evidence: [
            {
              source: briefPath,
              summary: "Constraint target: preserve uncertainty when direct proof is unavailable, stale, or outside the current run evidence."
            }
          ]
        }
      ]
    });
  }
};

// dist/flows/explore/writers/brief.js
function successCondition(goal) {
  return [
    `Answer the Explore goal with evidence-backed findings: ${goal}`,
    "Name the evidence inspected or still needed, separate confirmed facts from assumptions, and identify the proof that would make the recommendation trustworthy."
  ].join(" ");
}
var exploreBriefComposeBuilder = {
  resultSchemaName: "explore.brief@v1",
  build(context) {
    return ExploreBrief.parse({
      subject: context.goal,
      task: context.goal,
      success_condition: successCondition(context.goal)
    });
  }
};

// dist/flows/explore/writers/close.js
import { readFileSync as readFileSync3 } from "node:fs";
var POINTERS2 = [
  { report_id: "explore.brief", schema: "explore.brief@v1" },
  { report_id: "explore.analysis", schema: "explore.analysis@v1" },
  { report_id: "explore.compose", schema: "explore.compose@v1" },
  { report_id: "explore.review-verdict", schema: "explore.review-verdict@v1" }
];
var TOURNAMENT_POINTERS = [
  { report_id: "explore.brief", schema: "explore.brief@v1" },
  { report_id: "explore.analysis", schema: "explore.analysis@v1" },
  { report_id: "explore.decision-options", schema: "explore.decision-options@v1" },
  { report_id: "explore.tournament-aggregate", schema: "explore.tournament-aggregate@v1" },
  { report_id: "explore.tournament-review", schema: "explore.tournament-review@v1" },
  { report_id: "explore.decision", schema: "explore.decision@v1" }
];
function requiredTournamentAggregatePath(context) {
  const path = context.closeStep.reads.find((entry) => entry.endsWith("tournament-aggregate.json"));
  if (path === void 0) {
    throw new Error("explore.result@v1 tournament close requires tournament aggregate read");
  }
  return path;
}
function requiredInput(context, name, schema) {
  const input = context.inputs[name];
  if (input !== void 0)
    return input;
  const path = reportPathForSchemaInCompiledFlow(context.flow, schema);
  throw new Error(`explore.result@v1 requires close step '${context.closeStep.id}' to read ${path}`);
}
function reviewHasFoldIns(review) {
  return review.verdict === "accept-with-fold-ins" || review.objections.length > 0 || review.missed_angles.length > 0;
}
var exploreCloseBuilder = {
  resultSchemaName: "explore.result@v1",
  reads: [
    { name: "brief", schema: "explore.brief@v1", required: true },
    { name: "compose", schema: "explore.compose@v1", required: false },
    { name: "review", schema: "explore.review-verdict@v1", required: false },
    { name: "decisionOptions", schema: "explore.decision-options@v1", required: false },
    { name: "tournamentReview", schema: "explore.tournament-review@v1", required: false },
    { name: "decision", schema: "explore.decision@v1", required: false }
  ],
  build(context) {
    const brief = ExploreBrief.parse(context.inputs.brief);
    if (context.inputs.decision !== void 0) {
      ExploreDecisionOptions.parse(context.inputs.decisionOptions);
      const review2 = ExploreTournamentReview.parse(context.inputs.tournamentReview);
      const decision2 = ExploreDecision.parse(context.inputs.decision);
      const aggregatePath = requiredTournamentAggregatePath(context);
      ExploreTournamentAggregate.parse(JSON.parse(readFileSync3(resolveRunRelative(context.runFolder, aggregatePath), "utf8")));
      return ExploreResult.parse({
        summary: `Explore '${brief.subject}': ${decision2.decision}`,
        verdict_snapshot: {
          decision_verdict: decision2.verdict,
          tournament_review_verdict: review2.verdict,
          selected_option_id: decision2.selected_option_id,
          objection_count: review2.objections.length,
          missing_evidence_count: review2.missing_evidence.length
        },
        evidence_links: TOURNAMENT_POINTERS.map((p) => ({
          ...p,
          path: p.schema === "explore.tournament-aggregate@v1" ? aggregatePath : reportPathForSchemaInCompiledFlow(context.flow, p.schema)
        }))
      });
    }
    const compose = ExploreCompose.parse(requiredInput(context, "compose", "explore.compose@v1"));
    const review = ExploreReviewVerdict.parse(requiredInput(context, "review", "explore.review-verdict@v1"));
    return ExploreResult.parse({
      summary: `Explore '${brief.subject}': ${compose.recommendation}`,
      verdict_snapshot: {
        compose_verdict: compose.verdict,
        review_verdict: review.verdict,
        objection_count: review.objections.length,
        missed_angle_count: review.missed_angles.length
      },
      ...reviewHasFoldIns(review) ? {
        review_fold_ins: {
          overall_assessment: review.overall_assessment,
          objections: review.objections,
          missed_angles: review.missed_angles
        }
      } : {},
      evidence_links: POINTERS2.map((p) => ({
        ...p,
        path: reportPathForSchemaInCompiledFlow(context.flow, p.schema)
      }))
    });
  }
};

// dist/flows/explore/writers/decision-options.js
var FALLBACK_LABELS = [
  "Conservative path",
  "Ambitious path",
  "Hybrid path",
  "Defer pending evidence"
];
var EXPLICIT_FILL_LABELS = [
  "Hybrid path",
  "Defer pending evidence",
  "Conservative path",
  "Ambitious path"
];
function stripDecisionPrefix(task) {
  return task.replace(/^\s*(?:decide|choose|select|pick|compare)\s*:\s*/i, "").trim();
}
function cleanOptionLabel(raw) {
  const label = raw.replace(/^\s*(?:choose|select|pick|between|among|whether to)\s+/i, "").replace(/\s+/g, " ").replace(/[.?!:;]+$/g, "").trim();
  return label.length > 0 ? label : void 0;
}
function uniqueLabels(labels) {
  const seen = /* @__PURE__ */ new Set();
  const out = [];
  for (const label of labels) {
    const key = label.toLocaleLowerCase();
    if (seen.has(key))
      continue;
    seen.add(key);
    out.push(label);
  }
  return out;
}
function explicitOptionLabels(task) {
  const text = stripDecisionPrefix(task);
  const between = /\bbetween\s+(.+?)\s+and\s+(.+)$/i.exec(text);
  if (between !== null) {
    return uniqueLabels([between[1] ?? "", between[2] ?? ""].flatMap((label) => cleanOptionLabel(label) ?? []));
  }
  const separators = /\s+(?:vs\.?|versus)\s+| ?\/ ?/i;
  if (separators.test(text)) {
    return uniqueLabels(text.split(separators).flatMap((label) => cleanOptionLabel(label) ?? []));
  }
  const commaParts = text.split(/\s*,\s*(?:or\s+)?|\s+or\s+/i);
  if (commaParts.length > 1) {
    return uniqueLabels(commaParts.flatMap((label) => cleanOptionLabel(label) ?? []));
  }
  return [];
}
function boundedOptionLabels(task) {
  const explicit = explicitOptionLabels(task).slice(0, 4);
  const labels = [...explicit];
  const fallbackPool = explicit.length > 0 ? EXPLICIT_FILL_LABELS : FALLBACK_LABELS;
  for (const fallback of fallbackPool) {
    if (labels.length >= 4)
      break;
    if (!labels.some((label) => label.toLocaleLowerCase() === fallback.toLocaleLowerCase())) {
      labels.push(fallback);
    }
  }
  return labels.slice(0, 4);
}
function summaryForLabel(label, subject) {
  if (label === "Hybrid path") {
    return `Combine the strongest parts of the named options for ${subject} before locking the choice.`;
  }
  if (label === "Defer pending evidence") {
    return `Pause the final choice for ${subject} until the missing evidence is gathered.`;
  }
  return `Choose ${label} as the best-supported path for ${subject}.`;
}
function promptForLabel(label, task) {
  if (label === "Hybrid path") {
    return `Make the strongest case for a hybrid path on ${task}.`;
  }
  if (label === "Defer pending evidence") {
    return `Make the strongest case for deferring ${task} until the missing evidence is gathered.`;
  }
  return `Make the strongest case for choosing ${label} on ${task}.`;
}
var exploreDecisionOptionsComposeBuilder = {
  resultSchemaName: "explore.decision-options@v1",
  reads: [
    { name: "brief", schema: "explore.brief@v1", required: true },
    { name: "analysis", schema: "explore.analysis@v1", required: true }
  ],
  build(context) {
    const brief = ExploreBrief.parse(context.inputs.brief);
    const analysis = ExploreAnalysis.parse(context.inputs.analysis);
    const primaryEvidence = analysis.aspects[0]?.evidence[0]?.source ?? context.step.reads[0] ?? "reports/analysis.json";
    const optionLabels = boundedOptionLabels(brief.task);
    return ExploreDecisionOptions.parse({
      decision_question: `Which path should Circuit recommend for: ${brief.task}?`,
      recommendation_basis: "Compare the named options and bounded fallback choices against the available evidence.",
      options: optionLabels.map((label, index) => ({
        id: `option-${index + 1}`,
        label,
        summary: summaryForLabel(label, brief.subject),
        best_case_prompt: promptForLabel(label, brief.task),
        evidence_refs: [primaryEvidence],
        tradeoffs: [
          label === "Defer pending evidence" ? "Reduces decision risk" : "Can move the decision forward now",
          label === "Hybrid path" ? "May blur ownership of the final direction" : "May miss strengths from another option"
        ]
      }))
    });
  }
};

// dist/flows/explore/writers/decision.js
import { readFileSync as readFileSync4 } from "node:fs";
var CHECKPOINT_RESPONSE_STEP_ID = "tradeoff-checkpoint-step";
function readJson(runFolder, path) {
  return JSON.parse(readFileSync4(resolveRunRelative(runFolder, path), "utf8"));
}
function requiredRead(stepReads, suffix) {
  const path = stepReads.find((entry) => entry.endsWith(suffix));
  if (path === void 0) {
    throw new Error(`explore.decision@v1 requires a read ending in ${suffix}`);
  }
  return path;
}
function checkpointResponsePath(context) {
  const checkpoint = context.flow.steps.find((step) => step.kind === "checkpoint" && step.id === CHECKPOINT_RESPONSE_STEP_ID);
  if (checkpoint?.kind !== "checkpoint") {
    throw new Error("explore.decision@v1 requires the tradeoff checkpoint step");
  }
  return checkpoint.writes.response;
}
function followUpWorkflowFor(nextAction) {
  const match = /\b(Build|Fix|Migrate|Sweep|Explore|Review)\b/i.exec(nextAction);
  if (match?.[1] === void 0)
    return "Explore";
  const lower = match[1].toLowerCase();
  return lower[0]?.toUpperCase() + lower.slice(1);
}
var exploreDecisionComposeBuilder = {
  resultSchemaName: "explore.decision@v1",
  build(context) {
    const optionsPath = requiredRead(context.step.reads, "decision-options.json");
    const aggregatePath = requiredRead(context.step.reads, "tournament-aggregate.json");
    const reviewPath = requiredRead(context.step.reads, "tournament-review.json");
    const responsePath = checkpointResponsePath(context);
    const options = ExploreDecisionOptions.parse(readJson(context.runFolder, optionsPath));
    const aggregate = ExploreTournamentAggregate.parse(readJson(context.runFolder, aggregatePath));
    const review = ExploreTournamentReview.parse(readJson(context.runFolder, reviewPath));
    const response = readJson(context.runFolder, responsePath);
    const rawSelection = response !== null && typeof response === "object" && !Array.isArray(response) ? response.selection : void 0;
    const selectedOptionId = ExploreDecisionOptionId.parse(rawSelection);
    const selectedOption = options.options.find((option) => option.id === selectedOptionId);
    if (selectedOption === void 0) {
      throw new Error(`explore.decision@v1 selected option '${selectedOptionId}' is not present in decision options`);
    }
    const selectedBranch = aggregate.branches.find((branch) => branch.branch_id === selectedOption.id);
    const selectedProposal = selectedBranch?.result_body;
    if (selectedProposal === void 0) {
      throw new Error(`explore.decision@v1 selected option '${selectedOption.id}' has no completed proposal branch`);
    }
    const rejectedOptions = options.options.filter((option) => option.id !== selectedOption.id).map((option) => ({
      option_id: option.id,
      reason: `Not selected by the tradeoff checkpoint; review verdict was ${review.verdict}.`
    }));
    return ExploreDecision.parse({
      verdict: "decided",
      decision_question: options.decision_question,
      selected_option_id: selectedOption.id,
      selected_option_label: selectedOption.label,
      decision: selectedProposal.case_summary,
      rationale: review.comparison,
      rejected_options: rejectedOptions,
      evidence_links: [optionsPath, aggregatePath, reviewPath, responsePath],
      assumptions: selectedProposal.assumptions,
      residual_risks: [...selectedProposal.risks, ...review.objections, ...review.missing_evidence],
      next_action: selectedProposal.next_action,
      follow_up_workflow: followUpWorkflowFor(selectedProposal.next_action)
    });
  }
};

// dist/flows/explore/index.js
var exploreCompiledFlowPackage = {
  id: "explore",
  visibility: "public",
  paths: {
    schematic: "src/flows/explore/schematic.json",
    command: "src/flows/explore/command.md",
    contract: "src/flows/explore/contract.md"
  },
  routing: {
    order: Number.MAX_SAFE_INTEGER,
    signals: [],
    reasonForMatch() {
      throw new Error("explore is the default flow; reasonForMatch should not be called");
    },
    isDefault: true,
    defaultReason: "no routed flow signal matched; routed to explore as the conservative default"
  },
  relayReports: [
    {
      schemaName: "explore.compose@v1",
      schema: ExploreCompose,
      relayHint: exploreComposeShapeHint.instruction
    },
    {
      schemaName: "explore.review-verdict@v1",
      schema: ExploreReviewVerdict,
      relayHint: exploreReviewVerdictShapeHint.instruction
    },
    {
      schemaName: "explore.tournament-proposal@v1",
      schema: ExploreTournamentProposal,
      relayHint: exploreTournamentProposalShapeHint.instruction
    },
    {
      schemaName: "explore.tournament-review@v1",
      schema: ExploreTournamentReview,
      relayHint: exploreTournamentReviewShapeHint.instruction
    }
  ],
  reportSchemas: [
    { schemaName: "explore.brief@v1", schema: ExploreBrief },
    { schemaName: "explore.analysis@v1", schema: ExploreAnalysis },
    { schemaName: "explore.decision-options@v1", schema: ExploreDecisionOptions },
    { schemaName: "explore.tournament-aggregate@v1", schema: ExploreTournamentAggregate },
    { schemaName: "explore.decision@v1", schema: ExploreDecision },
    { schemaName: "explore.result@v1", schema: ExploreResult }
  ],
  writers: {
    compose: [
      exploreBriefComposeBuilder,
      exploreAnalysisComposeBuilder,
      exploreDecisionOptionsComposeBuilder,
      exploreDecisionComposeBuilder
    ],
    close: [exploreCloseBuilder],
    verification: [],
    checkpoint: []
  }
};

// dist/flows/fix/relay-hints.js
var fixContextShapeHint = {
  kind: "schema",
  schema: "fix.context@v1",
  instruction: [
    "Respond with a single raw JSON object whose top-level shape is exactly:",
    '{ "verdict": "accept", "sources": [{ "kind": "<file|command|log|operator-note|reference>", "ref": "<project-relative path, command id, log line, note id, or external reference>", "summary": "<one-line summary of what this source contributed>" }], "observations": ["<observation grounded in the sources>"], "open_questions": ["<question still unresolved after gathering context>"] }',
    "sources must contain at least one entry; observations must contain at least one entry. Use an empty open_questions array only when nothing remains unresolved. Every observation must be grounded in the cited sources \u2014 do not invent details that the sources do not support.",
    "Do not include extra top-level keys. Do not wrap the JSON in Markdown code fences. Do not include any prose before or after the JSON object.",
    "The runtime parses your response with JSON.parse, rejects any verdict not drawn from the accepted-verdicts list, and validates the full report body against fix.context@v1 before writing reports/fix/context.json."
  ].join(" ")
};
var fixDiagnosisShapeHint = {
  kind: "schema",
  schema: "fix.diagnosis@v1",
  instruction: [
    "Respond with a single raw JSON object whose top-level shape is exactly:",
    '{ "verdict": "accept", "reproduction_status": "<reproduced|not-reproduced|intermittent|not-attempted>", "cause_summary": "<one-line root-cause statement>", "confidence": "<low|medium|high>", "evidence": ["<file:line, command result, or report reference that supports the cause>"], "residual_uncertainty": ["<remaining unknown that could still affect the fix>"] }',
    'evidence must contain at least one entry. residual_uncertainty must be non-empty whenever reproduction_status is anything other than "reproduced" \u2014 if you could not cleanly reproduce the bug, name the unknowns honestly. Calibrate confidence to the evidence: do not claim "high" without direct reproduction or equivalent proof.',
    "Do not include extra top-level keys. Do not wrap the JSON in Markdown code fences. Do not include any prose before or after the JSON object.",
    "The runtime parses your response with JSON.parse, rejects any verdict not drawn from the accepted-verdicts list, and validates the full report body against fix.diagnosis@v1 before writing reports/fix/diagnosis.json."
  ].join(" ")
};
var fixChangeShapeHint = {
  kind: "schema",
  schema: "fix.change@v1",
  instruction: [
    "Respond with a single raw JSON object whose top-level shape is exactly:",
    '{ "verdict": "accept", "summary": "<what changed and why>", "diagnosis_ref": "<reference to the diagnosis report or section that motivates this change>", "changed_files": ["<project-relative path that was edited>"], "evidence": ["<test output, command result, or before/after observation that confirms the change works>"] }',
    "Make the smallest change that resolves the diagnosed cause. Do not refactor adjacent code, broaden behavior, or address unrelated issues in the same edit. changed_files must contain at least one entry; evidence must contain at least one entry.",
    "Do not include extra top-level keys. Do not wrap the JSON in Markdown code fences. Do not include any prose before or after the JSON object.",
    "The runtime parses your response with JSON.parse, rejects any verdict not drawn from the accepted-verdicts list, and validates the full report body against fix.change@v1 before writing reports/fix/change.json."
  ].join(" ")
};
var fixReviewShapeHint = {
  kind: "schema",
  schema: "fix.review@v1",
  instruction: [
    "Respond with a single raw JSON object whose top-level shape is exactly:",
    '{ "verdict": "<accept|accept-with-fixes|reject>", "summary": "<review summary>", "findings": [{ "severity": "<critical|high|medium|low>", "text": "<finding text>", "file_refs": ["<file:line reference>"] }] }',
    "Review the change against the diagnosed cause and the brief's success criteria, not just against passing verification. Flag changes that broaden semantics beyond the bug being fixed even when the regression test passes.",
    'Use an empty findings array only with verdict "accept". Verdicts "accept-with-fixes" and "reject" must include at least one finding. Use an empty file_refs array when a finding has no file-specific reference. Do not include extra top-level keys. Do not wrap the JSON in Markdown code fences. Do not include any prose before or after the JSON object.',
    "The runtime parses your response with JSON.parse, rejects any verdict not drawn from the accepted-verdicts list, and validates the full report body against fix.review@v1 before writing reports/fix/review.json."
  ].join(" ")
};

// dist/flows/fix/reports.js
var FIX_RESULT_SCHEMA_BY_ARTIFACT_ID = {
  "fix.brief": "fix.brief@v1",
  "fix.context": "fix.context@v1",
  "fix.diagnosis": "fix.diagnosis@v1",
  "fix.no-repro-decision": "fix.no-repro-decision@v1",
  "fix.change": "fix.change@v1",
  "fix.verification": "fix.verification@v1",
  "fix.review": "fix.review@v1"
};
var FIX_RESULT_PATH_BY_ARTIFACT_ID = {
  "fix.brief": "reports/fix/brief.json",
  "fix.context": "reports/fix/context.json",
  "fix.diagnosis": "reports/fix/diagnosis.json",
  "fix.no-repro-decision": "reports/fix/no-repro-decision.json",
  "fix.change": "reports/fix/change.json",
  "fix.verification": "reports/fix/verification.json",
  "fix.review": "reports/fix/review.json"
};
var REQUIRED_FIX_RESULT_ARTIFACT_IDS = [
  "fix.brief",
  "fix.context",
  "fix.diagnosis",
  "fix.change",
  "fix.verification"
];
var NonEmptyStringArray2 = external_exports.array(external_exports.string().min(1)).min(1);
var FixVerificationCommand = VerificationCommand;
var FixRegressionContract = external_exports.object({
  expected_behavior: external_exports.string().min(1),
  actual_behavior: external_exports.string().min(1),
  repro: external_exports.discriminatedUnion("kind", [
    external_exports.object({
      kind: external_exports.literal("command"),
      command: FixVerificationCommand
    }).strict(),
    external_exports.object({
      kind: external_exports.literal("procedure"),
      procedure: external_exports.string().min(1)
    }).strict(),
    external_exports.object({
      kind: external_exports.literal("not-reproducible"),
      deferred_reason: external_exports.string().min(1)
    }).strict()
  ]),
  regression_test: external_exports.discriminatedUnion("status", [
    external_exports.object({
      status: external_exports.literal("failing-before-fix"),
      command: FixVerificationCommand
    }).strict(),
    external_exports.object({
      status: external_exports.literal("deferred"),
      deferred_reason: external_exports.string().min(1)
    }).strict()
  ])
}).strict().superRefine((contract, ctx) => {
  if (contract.repro.kind !== "not-reproducible" && contract.regression_test.status !== "failing-before-fix") {
    ctx.addIssue({
      code: external_exports.ZodIssueCode.custom,
      path: ["regression_test", "status"],
      message: "regression_test.status must be 'failing-before-fix' when repro evidence exists"
    });
  }
});
var FixBrief = external_exports.object({
  problem_statement: external_exports.string().min(1),
  expected_behavior: external_exports.string().min(1),
  observed_behavior: external_exports.string().min(1),
  scope: external_exports.string().min(1),
  regression_contract: FixRegressionContract,
  success_criteria: NonEmptyStringArray2,
  verification_command_candidates: external_exports.array(FixVerificationCommand).min(1)
}).strict();
var FixContextSource = external_exports.object({
  kind: external_exports.enum(["file", "command", "log", "operator-note", "reference"]),
  ref: external_exports.string().min(1),
  summary: external_exports.string().min(1)
}).strict();
var FixContext = external_exports.object({
  verdict: external_exports.literal("accept"),
  sources: external_exports.array(FixContextSource).min(1),
  observations: NonEmptyStringArray2,
  open_questions: external_exports.array(external_exports.string().min(1))
}).strict();
var FixReproductionStatus = external_exports.enum([
  "reproduced",
  "not-reproduced",
  "intermittent",
  "not-attempted"
]);
var FixDiagnosis = external_exports.object({
  verdict: external_exports.literal("accept"),
  reproduction_status: FixReproductionStatus,
  cause_summary: external_exports.string().min(1),
  confidence: external_exports.enum(["low", "medium", "high"]),
  evidence: NonEmptyStringArray2,
  residual_uncertainty: external_exports.array(external_exports.string().min(1))
}).strict().superRefine((diagnosis, ctx) => {
  if (diagnosis.reproduction_status !== "reproduced" && diagnosis.residual_uncertainty.length === 0) {
    ctx.addIssue({
      code: external_exports.ZodIssueCode.custom,
      path: ["residual_uncertainty"],
      message: "residual_uncertainty must be non-empty when the problem was not cleanly reproduced"
    });
  }
});
var FixNoReproDecisionKind = external_exports.enum([
  "add-diagnostics",
  "continue-with-small-fix",
  "stop-as-not-reproduced",
  "handoff",
  "escalate"
]);
var FixNoReproRoute = external_exports.enum(["continue", "revise", "stop", "handoff", "escalate"]);
var NO_REPRO_DECISION_ROUTE = {
  "add-diagnostics": "revise",
  "continue-with-small-fix": "continue",
  "stop-as-not-reproduced": "stop",
  handoff: "handoff",
  escalate: "escalate"
};
var FixNoReproDecision = external_exports.object({
  decision: FixNoReproDecisionKind,
  selected_route: FixNoReproRoute,
  answered_by: external_exports.enum(["operator", "mode-default", "host-default"]),
  rationale: external_exports.string().min(1)
}).strict().superRefine((decision2, ctx) => {
  const expected = NO_REPRO_DECISION_ROUTE[decision2.decision];
  if (decision2.selected_route !== expected) {
    ctx.addIssue({
      code: external_exports.ZodIssueCode.custom,
      path: ["selected_route"],
      message: `selected_route must be '${expected}' for decision '${decision2.decision}'`
    });
  }
});
var FixChange = external_exports.object({
  verdict: external_exports.literal("accept"),
  summary: external_exports.string().min(1),
  diagnosis_ref: external_exports.string().min(1),
  changed_files: NonEmptyStringArray2,
  evidence: NonEmptyStringArray2
}).strict();
var FixVerificationCommandResult = external_exports.object({
  command_id: external_exports.string().min(1),
  cwd: external_exports.string().min(1),
  argv: external_exports.array(external_exports.string().min(1)).min(1),
  timeout_ms: external_exports.number().int().positive(),
  max_output_bytes: external_exports.number().int().positive(),
  env: external_exports.record(external_exports.string(), external_exports.string()),
  exit_code: external_exports.number().int().nonnegative(),
  status: external_exports.enum(["passed", "failed"]),
  duration_ms: external_exports.number().int().nonnegative(),
  stdout_summary: external_exports.string(),
  stderr_summary: external_exports.string()
}).strict().superRefine((result, ctx) => {
  const commandParse = FixVerificationCommand.safeParse({
    id: result.command_id,
    cwd: result.cwd,
    argv: result.argv,
    timeout_ms: result.timeout_ms,
    max_output_bytes: result.max_output_bytes,
    env: result.env
  });
  if (!commandParse.success) {
    ctx.addIssue({
      code: external_exports.ZodIssueCode.custom,
      path: ["argv"],
      message: `verification command result must include a safe command spec: ${commandParse.error.issues.map((issue) => issue.message).join("; ")}`
    });
  }
  const expected = result.exit_code === 0 ? "passed" : "failed";
  if (result.status !== expected) {
    ctx.addIssue({
      code: external_exports.ZodIssueCode.custom,
      path: ["status"],
      message: `status must be '${expected}' when exit_code is ${result.exit_code}`
    });
  }
});
var FixVerification = external_exports.object({
  overall_status: external_exports.enum(["passed", "failed"]),
  commands: external_exports.array(FixVerificationCommandResult).min(1)
}).strict().superRefine((verification, ctx) => {
  const expected = verification.commands.some((command) => command.status === "failed") ? "failed" : "passed";
  if (verification.overall_status !== expected) {
    ctx.addIssue({
      code: external_exports.ZodIssueCode.custom,
      path: ["overall_status"],
      message: `overall_status must be '${expected}' for command results`
    });
  }
});
var FixReviewVerdict = external_exports.enum(["accept", "accept-with-fixes", "reject"]);
var FixReviewFinding = external_exports.object({
  severity: external_exports.enum(["critical", "high", "medium", "low"]),
  text: external_exports.string().min(1),
  file_refs: external_exports.array(external_exports.string().min(1))
}).strict();
var FixReview = external_exports.object({
  verdict: FixReviewVerdict,
  summary: external_exports.string().min(1),
  findings: external_exports.array(FixReviewFinding)
}).strict().superRefine((review, ctx) => {
  if (review.verdict !== "accept" && review.findings.length === 0) {
    ctx.addIssue({
      code: external_exports.ZodIssueCode.custom,
      path: ["findings"],
      message: `findings must be non-empty when verdict is '${review.verdict}'`
    });
  }
});
var FixResultOutcome = external_exports.enum([
  "fixed",
  "not-reproduced",
  "partial",
  "stopped",
  "handoff",
  "failed"
]);
var FixResultReportId = external_exports.enum([
  "fix.brief",
  "fix.context",
  "fix.diagnosis",
  "fix.no-repro-decision",
  "fix.change",
  "fix.verification",
  "fix.review"
]);
var FixResultReportPointer = external_exports.object({
  report_id: FixResultReportId,
  path: external_exports.string().min(1),
  schema: external_exports.string().min(1)
}).strict().superRefine((pointer, ctx) => {
  const expectedSchema = FIX_RESULT_SCHEMA_BY_ARTIFACT_ID[pointer.report_id];
  if (pointer.schema !== expectedSchema) {
    ctx.addIssue({
      code: external_exports.ZodIssueCode.custom,
      path: ["schema"],
      message: `schema must be '${expectedSchema}' for report_id '${pointer.report_id}'`
    });
  }
  const expectedPath = FIX_RESULT_PATH_BY_ARTIFACT_ID[pointer.report_id];
  if (pointer.path !== expectedPath) {
    ctx.addIssue({
      code: external_exports.ZodIssueCode.custom,
      path: ["path"],
      message: `path must be '${expectedPath}' for report_id '${pointer.report_id}'`
    });
  }
});
var FixReviewStatus = external_exports.enum(["completed", "skipped"]);
var FixResult = external_exports.object({
  summary: external_exports.string().min(1),
  outcome: FixResultOutcome,
  verification_status: external_exports.enum(["passed", "failed", "not-run"]),
  regression_status: external_exports.enum(["proved", "deferred", "not-applicable"]),
  review_status: FixReviewStatus,
  review_verdict: FixReviewVerdict.optional(),
  review_skip_reason: external_exports.string().min(1).optional(),
  residual_risks: external_exports.array(external_exports.string().min(1)),
  evidence_links: external_exports.array(FixResultReportPointer).min(REQUIRED_FIX_RESULT_ARTIFACT_IDS.length).max(FixResultReportId.options.length)
}).strict().superRefine((result, ctx) => {
  const seen = /* @__PURE__ */ new Set();
  for (const [index, pointer] of result.evidence_links.entries()) {
    if (seen.has(pointer.report_id)) {
      ctx.addIssue({
        code: external_exports.ZodIssueCode.custom,
        path: ["evidence_links", index, "report_id"],
        message: `duplicate report_id '${pointer.report_id}'`
      });
    }
    seen.add(pointer.report_id);
  }
  for (const reportId of REQUIRED_FIX_RESULT_ARTIFACT_IDS) {
    if (!seen.has(reportId)) {
      ctx.addIssue({
        code: external_exports.ZodIssueCode.custom,
        path: ["evidence_links"],
        message: `missing report_id '${reportId}'`
      });
    }
  }
  if (result.outcome === "fixed" && result.verification_status !== "passed") {
    ctx.addIssue({
      code: external_exports.ZodIssueCode.custom,
      path: ["verification_status"],
      message: "verification_status must be 'passed' when outcome is 'fixed'"
    });
  }
  if (result.outcome === "fixed" && result.regression_status !== "proved") {
    ctx.addIssue({
      code: external_exports.ZodIssueCode.custom,
      path: ["regression_status"],
      message: "regression_status must be 'proved' when outcome is 'fixed'"
    });
  }
  if (result.outcome === "fixed" && result.review_verdict === "reject") {
    ctx.addIssue({
      code: external_exports.ZodIssueCode.custom,
      path: ["review_verdict"],
      message: "review_verdict cannot be 'reject' when outcome is 'fixed'"
    });
  }
  if (result.outcome === "fixed" && result.review_status === "completed" && result.review_verdict !== "accept") {
    ctx.addIssue({
      code: external_exports.ZodIssueCode.custom,
      path: ["review_verdict"],
      message: "review_verdict must be 'accept' when outcome is 'fixed' and review completed"
    });
  }
  if (result.review_status === "completed") {
    if (result.review_verdict === void 0) {
      ctx.addIssue({
        code: external_exports.ZodIssueCode.custom,
        path: ["review_verdict"],
        message: "review_verdict is required when review_status is 'completed'"
      });
    }
    if (!seen.has("fix.review")) {
      ctx.addIssue({
        code: external_exports.ZodIssueCode.custom,
        path: ["evidence_links"],
        message: "review_status 'completed' must include the fix.review evidence link"
      });
    }
  }
  if (result.review_status === "skipped") {
    if (result.review_skip_reason === void 0) {
      ctx.addIssue({
        code: external_exports.ZodIssueCode.custom,
        path: ["review_skip_reason"],
        message: "review_skip_reason is required when review_status is 'skipped'"
      });
    }
    if (result.review_verdict !== void 0) {
      ctx.addIssue({
        code: external_exports.ZodIssueCode.custom,
        path: ["review_verdict"],
        message: "review_verdict must be omitted when review_status is 'skipped'"
      });
    }
  }
  if (result.outcome === "not-reproduced" && !seen.has("fix.no-repro-decision")) {
    ctx.addIssue({
      code: external_exports.ZodIssueCode.custom,
      path: ["evidence_links"],
      message: "outcome 'not-reproduced' must include the fix.no-repro-decision evidence link"
    });
  }
});

// dist/flows/fix/writers/brief.js
var DEFAULT_FIX_VERIFICATION_COMMAND = {
  id: "fix-proof",
  cwd: ".",
  argv: ["npm", "run", "verify"],
  timeout_ms: 6e5,
  max_output_bytes: 2e5,
  env: {}
};
var fixBriefComposeBuilder = {
  resultSchemaName: "fix.brief@v1",
  build(context) {
    const goal = context.goal;
    return FixBrief.parse({
      problem_statement: goal,
      expected_behavior: `Resolve: ${goal}`,
      observed_behavior: `Currently: ${goal}`,
      scope: goal,
      regression_contract: {
        expected_behavior: `After fix: ${goal}`,
        actual_behavior: `Before fix: ${goal}`,
        repro: {
          kind: "not-reproducible",
          deferred_reason: "Default Fix brief \u2014 operator-supplied repro evidence not available at frame time"
        },
        regression_test: {
          status: "deferred",
          deferred_reason: "Default Fix brief \u2014 regression-test authoring deferred until repro evidence is supplied"
        }
      },
      success_criteria: [`Demonstrate the fix addresses: ${goal}`],
      verification_command_candidates: [DEFAULT_FIX_VERIFICATION_COMMAND]
    });
  }
};

// dist/flows/fix/writers/close.js
var REQUIRED_POINTERS = [
  { report_id: "fix.brief", schema: "fix.brief@v1" },
  { report_id: "fix.context", schema: "fix.context@v1" },
  { report_id: "fix.diagnosis", schema: "fix.diagnosis@v1" },
  { report_id: "fix.change", schema: "fix.change@v1" },
  { report_id: "fix.verification", schema: "fix.verification@v1" }
];
var OPTIONAL_REVIEW_POINTER = {
  report_id: "fix.review",
  schema: "fix.review@v1"
};
var fixCloseBuilder = {
  resultSchemaName: "fix.result@v1",
  reads: [
    { name: "brief", schema: "fix.brief@v1", required: true },
    { name: "context", schema: "fix.context@v1", required: true },
    { name: "diagnosis", schema: "fix.diagnosis@v1", required: true },
    { name: "change", schema: "fix.change@v1", required: true },
    { name: "verification", schema: "fix.verification@v1", required: true },
    { name: "review", schema: "fix.review@v1", required: false }
  ],
  build(context) {
    const brief = FixBrief.parse(context.inputs.brief);
    FixContext.parse(context.inputs.context);
    const diagnosis = FixDiagnosis.parse(context.inputs.diagnosis);
    const change = FixChange.parse(context.inputs.change);
    const verification = FixVerification.parse(context.inputs.verification);
    const review = context.inputs.review === void 0 ? void 0 : FixReview.parse(context.inputs.review);
    const verificationStatus = verification.overall_status === "passed" ? "passed" : "failed";
    const regressionStatus = brief.regression_contract.regression_test.status === "failing-before-fix" ? "proved" : "deferred";
    const reviewStatus = review === void 0 ? "skipped" : "completed";
    const outcome = diagnosis.reproduction_status === "not-reproduced" ? "not-reproduced" : verificationStatus === "passed" && regressionStatus === "proved" && (review === void 0 || review.verdict === "accept") ? "fixed" : verificationStatus === "passed" && (regressionStatus !== "proved" || review?.verdict === "accept-with-fixes") ? "partial" : "failed";
    const pointers = REQUIRED_POINTERS.map((p) => ({
      report_id: p.report_id,
      schema: p.schema,
      path: reportPathForSchemaInCompiledFlow(context.flow, p.schema)
    }));
    if (review !== void 0) {
      pointers.push({
        report_id: OPTIONAL_REVIEW_POINTER.report_id,
        schema: OPTIONAL_REVIEW_POINTER.schema,
        path: reportPathForSchemaInCompiledFlow(context.flow, OPTIONAL_REVIEW_POINTER.schema)
      });
    }
    return FixResult.parse({
      summary: `Fix '${brief.problem_statement}': ${change.summary}`,
      outcome,
      verification_status: verificationStatus,
      regression_status: regressionStatus,
      review_status: reviewStatus,
      ...review === void 0 ? {} : { review_verdict: review.verdict },
      ...review === void 0 ? { review_skip_reason: "Lite mode skipped review per route_overrides." } : {},
      residual_risks: [...diagnosis.residual_uncertainty],
      evidence_links: pointers
    });
  }
};

// dist/flows/fix/writers/verification.js
import { readFileSync as readFileSync5 } from "node:fs";
var fixVerificationWriter = {
  resultSchemaName: "fix.verification@v1",
  loadCommands(context) {
    const briefPath = reportPathForSchemaInCompiledFlow(context.flow, "fix.brief@v1");
    if (!context.step.reads.includes(briefPath)) {
      throw new Error(`fix.verification@v1 requires step '${context.step.id}' to read ${briefPath}`);
    }
    const brief = FixBrief.parse(JSON.parse(readFileSync5(resolveRunRelative(context.runFolder, briefPath), "utf8")));
    return brief.verification_command_candidates;
  },
  buildResult(observations) {
    const overallStatus = observations.some((o) => o.status === "failed") ? "failed" : "passed";
    return FixVerification.parse({
      overall_status: overallStatus,
      commands: observations.map((o) => ({
        command_id: o.command.id,
        argv: o.command.argv,
        cwd: o.command.cwd,
        exit_code: o.exit_code,
        status: o.status,
        duration_ms: o.duration_ms,
        stdout_summary: o.stdout_summary,
        stderr_summary: o.stderr_summary,
        timeout_ms: o.command.timeout_ms,
        max_output_bytes: o.command.max_output_bytes,
        env: o.command.env
      }))
    });
  }
};

// dist/flows/fix/index.js
var FIX_SIGNALS = [
  { label: "fix prefix", pattern: /^\s*fix\s*:/i },
  { label: "quick fix prefix", pattern: /^\s*(?:quick|small|tiny|simple)\s+fix\s*:/i },
  {
    label: "fix request",
    pattern: /^\s*(?:please\s+)?(?:fix|patch|debug|diagnose|reproduce)\s+(?:a\s+|an\s+|the\s+|this\s+|that\s+|my\s+|some\s+)?\S+/i
  },
  {
    label: "trailing fix request",
    pattern: /\b(?:bug|buggy|broken|failing|fails|failed|wrong|incorrect|instead\s+of|regression|crash|crashes|throw|throws)\b[\s\S]{0,200}\bfix\s+(?:it|this|that|please)\b/i
  }
];
var fixCompiledFlowPackage = {
  id: "fix",
  visibility: "public",
  paths: {
    schematic: "src/flows/fix/schematic.json",
    command: "src/flows/fix/command.md",
    contract: "src/flows/fix/contract.md"
  },
  routing: {
    order: 20,
    signals: FIX_SIGNALS,
    skipOnPlanningReport: true,
    reasonForMatch(signal) {
      return `matched ${signal.label}; routed to Fix flow`;
    }
  },
  relayReports: [
    {
      schemaName: "fix.context@v1",
      schema: FixContext,
      relayHint: fixContextShapeHint.instruction
    },
    {
      schemaName: "fix.diagnosis@v1",
      schema: FixDiagnosis,
      relayHint: fixDiagnosisShapeHint.instruction
    },
    {
      schemaName: "fix.change@v1",
      schema: FixChange,
      relayHint: fixChangeShapeHint.instruction
    },
    {
      schemaName: "fix.review@v1",
      schema: FixReview,
      relayHint: fixReviewShapeHint.instruction
    }
  ],
  reportSchemas: [
    { schemaName: "fix.brief@v1", schema: FixBrief },
    { schemaName: "fix.no-repro-decision@v1", schema: FixNoReproDecision },
    { schemaName: "fix.verification@v1", schema: FixVerification },
    { schemaName: "fix.result@v1", schema: FixResult }
  ],
  writers: {
    compose: [fixBriefComposeBuilder],
    close: [fixCloseBuilder],
    verification: [fixVerificationWriter],
    checkpoint: []
  }
};

// dist/flows/migrate/relay-hints.js
var migrateReviewShapeHint = {
  kind: "schema",
  schema: "migrate.review@v1",
  instruction: [
    "Respond with a single raw JSON object whose top-level shape is exactly:",
    '{ "verdict": "<release-approved|release-with-followups|release-blocked|reject>", "summary": "<release-review summary>", "findings": [{ "severity": "<critical|high|medium|low>", "text": "<finding text>", "file_refs": ["<file:line reference>"] }] }',
    'Audit the migration as a release decision: do the staged batches together satisfy the migration brief, did verification pass, and is anything left that would block ratification? Flag findings that name specific files, batches, or behaviors \u2014 do not file generic "looks good" notes.',
    'Use an empty findings array only with verdict "release-approved". Verdicts "release-with-followups", "release-blocked", and "reject" must include at least one finding. Use an empty file_refs array when a finding has no file-specific reference. Do not include extra top-level keys. Do not wrap the JSON in Markdown code fences. Do not include any prose before or after the JSON object.',
    "The runtime parses your response with JSON.parse, rejects any verdict not drawn from the accepted-verdicts list, and validates the full report body against migrate.review@v1 before writing reports/migrate/review.json."
  ].join(" ")
};
var migrateInventoryShapeHint = {
  kind: "schema",
  schema: "migrate.inventory@v1",
  instruction: [
    "Walk the project to enumerate every concrete location that needs to change for this migration. Use Glob, Grep, and Read to find real files and code patterns matching the brief's source / target / scope. Every items[].path must be a project-relative path that exists on disk; do not fabricate items. This step is read-only by intent: do NOT call Edit, Write, or any Bash command that modifies files.",
    "Respond with a single raw JSON object whose top-level shape is exactly:",
    '{ "verdict": "accept", "summary": "<what was inventoried>", "items": [{ "id": "<stable item id>", "path": "<project-relative path>", "category": "<e.g. import-site, config-file, test-only>", "description": "<one-line description of why this item is in scope>" }], "batches": [{ "id": "<stable batch id>", "title": "<short batch name>", "item_ids": ["<id from items above>"], "rationale": "<why these items group together>" }] }',
    "Each items[].id must be unique. Each batches[].item_ids[] must reference an items[].id (no orphans). The items array must contain at least one entry; if the walk finds nothing, investigate further before responding rather than emitting an empty inventory. The batches array must contain at least one entry covering at least one item.",
    "Do not include extra top-level keys. Do not wrap the JSON in Markdown code fences. Do not include any prose before or after the JSON object.",
    "The runtime parses your response with JSON.parse, rejects any verdict not drawn from the accepted-verdicts list, and validates the full report body against migrate.inventory@v1 before writing reports/migrate/inventory.json."
  ].join(" ")
};

// dist/schemas/ids.js
var slugPattern = /^[a-z][a-z0-9-]*$/;
var CompiledFlowId = external_exports.string().regex(slugPattern).brand();
var StageId = external_exports.string().regex(slugPattern).brand();
var StepId = external_exports.string().regex(slugPattern).brand();
var RunId = external_exports.string().uuid().brand();
var InvocationId = external_exports.string().regex(/^inv_[a-f0-9-]+$/).brand();
var SkillId = external_exports.string().regex(slugPattern).brand();
var SkillSlotId = external_exports.string().regex(slugPattern).brand();
var ProtocolId = external_exports.string().regex(/^[a-z][a-z0-9-]*@v\d+$/).brand();

// dist/schemas/change-kind.js
var ChangeKind = external_exports.enum([
  "ratchet-advance",
  "equivalence-refactor",
  "migration-escrow",
  "discovery",
  "disposable",
  "break-glass"
]);
var ChangeKindBase = external_exports.object({
  failure_mode: external_exports.string().min(1),
  acceptance_evidence: external_exports.string().min(1),
  alternate_framing: external_exports.string().min(1)
});
var MigrationEscrowChangeKind = ChangeKindBase.extend({
  change_kind: external_exports.literal("migration-escrow"),
  expires_at: external_exports.string().datetime(),
  restoration_plan: external_exports.string().min(1)
}).strict();
var BreakGlassChangeKind = ChangeKindBase.extend({
  change_kind: external_exports.literal("break-glass"),
  post_hoc_adr_deadline_at: external_exports.string().datetime()
}).strict();
var StandardChangeKind = ChangeKindBase.extend({
  change_kind: external_exports.enum(["ratchet-advance", "equivalence-refactor", "discovery", "disposable"])
});
var ChangeKindDeclaration = external_exports.discriminatedUnion("change_kind", [
  StandardChangeKind.extend({ change_kind: external_exports.literal("ratchet-advance") }).strict(),
  StandardChangeKind.extend({ change_kind: external_exports.literal("equivalence-refactor") }).strict(),
  StandardChangeKind.extend({ change_kind: external_exports.literal("discovery") }).strict(),
  StandardChangeKind.extend({ change_kind: external_exports.literal("disposable") }).strict(),
  MigrationEscrowChangeKind,
  BreakGlassChangeKind
]);

// dist/schemas/check.js
var ReportSource = external_exports.object({
  kind: external_exports.literal("report"),
  ref: external_exports.literal("report")
}).strict();
var CheckpointResponseSource = external_exports.object({
  kind: external_exports.literal("checkpoint_response"),
  ref: external_exports.literal("response")
}).strict();
var RelayResultSource = external_exports.object({
  kind: external_exports.literal("relay_result"),
  ref: external_exports.literal("result")
}).strict();
var SubRunResultSource = external_exports.object({
  kind: external_exports.literal("sub_run_result"),
  ref: external_exports.literal("result")
}).strict();
var FanoutResultsSource = external_exports.object({
  kind: external_exports.literal("fanout_results"),
  ref: external_exports.literal("aggregate")
}).strict();
var CheckSource = external_exports.discriminatedUnion("kind", [
  ReportSource,
  CheckpointResponseSource,
  RelayResultSource,
  SubRunResultSource,
  FanoutResultsSource
]);
var SchemaSectionsCheck = external_exports.object({
  kind: external_exports.literal("schema_sections"),
  source: ReportSource,
  required: external_exports.array(external_exports.string().min(1)).min(1)
}).strict();
var CheckpointSelectionCheck = external_exports.object({
  kind: external_exports.literal("checkpoint_selection"),
  source: CheckpointResponseSource,
  allow: external_exports.array(external_exports.string().min(1)).min(1)
}).strict();
var ResultVerdictCheck = external_exports.object({
  kind: external_exports.literal("result_verdict"),
  source: external_exports.discriminatedUnion("kind", [RelayResultSource, SubRunResultSource]),
  pass: external_exports.array(external_exports.string().min(1)).min(1)
}).strict();
var PickWinnerJoin = external_exports.object({
  policy: external_exports.literal("pick-winner")
}).strict();
var DisjointMergeJoin = external_exports.object({
  policy: external_exports.literal("disjoint-merge")
}).strict();
var AggregateOnlyJoin = external_exports.object({
  policy: external_exports.literal("aggregate-only")
}).strict();
var FanoutJoinPolicy = external_exports.discriminatedUnion("policy", [
  PickWinnerJoin,
  DisjointMergeJoin,
  AggregateOnlyJoin
]);
var FanoutAggregateCheck = external_exports.object({
  kind: external_exports.literal("fanout_aggregate"),
  source: FanoutResultsSource,
  join: FanoutJoinPolicy,
  // verdicts.admit is the per-child verdict allowlist consulted by
  // pick-winner (preference-ordered) and disjoint-merge (membership-only).
  // aggregate-only ignores the field but still requires it for surface
  // uniformity — schematic authors who later switch policies don't have to
  // reauthor the verdict surface.
  verdicts: external_exports.object({
    admit: external_exports.array(external_exports.string().min(1)).min(1)
  }).strict()
}).strict();
var Check = external_exports.discriminatedUnion("kind", [
  SchemaSectionsCheck,
  CheckpointSelectionCheck,
  ResultVerdictCheck,
  FanoutAggregateCheck
]);

// dist/schemas/depth.js
var Depth = external_exports.enum(["lite", "standard", "deep", "tournament", "autonomous"]);

// dist/schemas/json.js
var JsonPrimitive = external_exports.union([
  external_exports.string(),
  external_exports.number().refine((n) => Number.isFinite(n), {
    message: "JSON numbers must be finite"
  }),
  external_exports.boolean(),
  external_exports.null()
]);
var JsonValue = external_exports.lazy(() => external_exports.union([JsonPrimitive, external_exports.array(JsonValue), JsonObject]));
var JsonObject = external_exports.record(external_exports.string(), JsonValue);

// dist/schemas/selection-policy.js
var ProviderScopedModel = external_exports.object({
  provider: external_exports.enum(["openai", "anthropic", "gemini", "custom"]),
  model: external_exports.string().min(1)
}).strict();
var Effort = external_exports.enum(["none", "minimal", "low", "medium", "high", "xhigh"]);
var UniqueSkillArray = external_exports.array(SkillId).refine((arr) => new Set(arr).size === arr.length, (arr) => ({
  message: `skills array contains duplicates: ${[...new Set(arr.filter((s, i) => arr.indexOf(s) !== i))].join(", ")}`
}));
var SkillOverride = external_exports.discriminatedUnion("mode", [
  external_exports.object({ mode: external_exports.literal("inherit") }).strict(),
  external_exports.object({ mode: external_exports.literal("replace"), skills: UniqueSkillArray }).strict(),
  external_exports.object({ mode: external_exports.literal("append"), skills: UniqueSkillArray }).strict(),
  external_exports.object({ mode: external_exports.literal("remove"), skills: UniqueSkillArray }).strict()
]);
var SelectionOverride = external_exports.object({
  model: ProviderScopedModel.optional(),
  effort: Effort.optional(),
  skills: SkillOverride.default({ mode: "inherit" }),
  depth: Depth.optional(),
  invocation_options: JsonObject.default({})
}).strict();
var ResolvedSelection = external_exports.object({
  model: ProviderScopedModel.optional(),
  effort: Effort.optional(),
  skills: UniqueSkillArray,
  depth: Depth.optional(),
  invocation_options: JsonObject.default({})
}).strict();
var SelectionSource = external_exports.enum([
  "default",
  "user-global",
  "project",
  "flow",
  "stage",
  "step",
  "invocation"
]);
var SELECTION_PRECEDENCE = [
  "default",
  "user-global",
  "project",
  "flow",
  "stage",
  "step",
  "invocation"
];
var PRECEDENCE_INDEX = Object.fromEntries(SELECTION_PRECEDENCE.map((s, i) => [s, i]));
var AppliedEntry = external_exports.discriminatedUnion("source", [
  external_exports.object({ source: external_exports.literal("default"), override: SelectionOverride }).strict(),
  external_exports.object({ source: external_exports.literal("user-global"), override: SelectionOverride }).strict(),
  external_exports.object({ source: external_exports.literal("project"), override: SelectionOverride }).strict(),
  external_exports.object({ source: external_exports.literal("flow"), override: SelectionOverride }).strict(),
  external_exports.object({
    source: external_exports.literal("stage"),
    stage_id: StageId,
    override: SelectionOverride
  }).strict(),
  external_exports.object({ source: external_exports.literal("step"), step_id: StepId, override: SelectionOverride }).strict(),
  external_exports.object({ source: external_exports.literal("invocation"), override: SelectionOverride }).strict()
]);
function overrideContributes(o) {
  if (o.model !== void 0)
    return true;
  if (o.effort !== void 0)
    return true;
  if (o.depth !== void 0)
    return true;
  if (o.skills.mode !== "inherit")
    return true;
  if (Object.keys(o.invocation_options).length > 0)
    return true;
  return false;
}
var SelectionResolutionBody = external_exports.object({
  resolved: ResolvedSelection,
  applied: external_exports.array(AppliedEntry)
}).strict();
var issueAt = (ctx, path, message) => {
  ctx.addIssue({ code: external_exports.ZodIssueCode.custom, path, message });
};
function identityKey(entry) {
  switch (entry.source) {
    case "stage":
      return `stage:${entry.stage_id}`;
    case "step":
      return `step:${entry.step_id}`;
    default:
      return entry.source;
  }
}
var SelectionResolution = SelectionResolutionBody.superRefine((res, ctx) => {
  const seen = /* @__PURE__ */ new Set();
  let lastIndex = -1;
  for (let i = 0; i < res.applied.length; i++) {
    const entry = res.applied[i];
    if (entry === void 0)
      continue;
    const key = identityKey(entry);
    if (seen.has(key)) {
      issueAt(ctx, ["applied", i, "source"], `duplicate applied identity '${key}' at index ${i}; each identity may contribute at most once (stage/step are disambiguated by their id)`);
      continue;
    }
    seen.add(key);
    const idx = PRECEDENCE_INDEX[entry.source];
    if (idx < lastIndex) {
      issueAt(ctx, ["applied", i, "source"], `applied entry '${entry.source}' at index ${i} is out of precedence order; entries must appear in SELECTION_PRECEDENCE order (default < user-global < project < flow < stage < step < invocation). Two entries with equal precedence (two stages, two steps) are legal and must appear contiguously; a later category cannot precede an earlier one.`);
    } else {
      lastIndex = idx;
    }
    if (!overrideContributes(entry.override)) {
      issueAt(ctx, ["applied", i, "override"], `applied entry at index ${i} has an empty override (no model, effort, depth, skills operation, or invocation_options); a layer that contributes nothing must NOT appear in the applied chain (ghost provenance)`);
    }
  }
});

// dist/schemas/skill.js
var SkillDomain = external_exports.enum(["coding", "design", "research", "ops", "domain-general"]);
var descriptorOwnPropertyGuard = external_exports.custom((raw) => {
  if (raw === null || typeof raw !== "object")
    return true;
  const guarded = ["id", "title", "description", "trigger"];
  for (const f of guarded)
    if (!Object.hasOwn(raw, f))
      return false;
  return true;
}, "skill descriptor has inherited (not own) required field; prototype-chain smuggle rejected");
var SkillDescriptorBody = external_exports.object({
  id: SkillId,
  title: external_exports.string().min(1),
  description: external_exports.string().min(1),
  trigger: external_exports.string().min(1),
  /**
   * `capabilities`, when present, is a non-empty array of non-empty
   * strings. A catalog entry that has not declared any capabilities
   * should omit the field; an empty list `[]` is an ambiguity bug
   * and rejected.
   */
  capabilities: external_exports.array(external_exports.string().min(1)).min(1).optional(),
  domain: SkillDomain.default("domain-general")
}).strict();
var SkillDescriptor = descriptorOwnPropertyGuard.pipe(SkillDescriptorBody);
var HEX64 = /^[0-9a-f]{64}$/;
var UserSkillEntry = external_exports.object({
  id: SkillId,
  name: external_exports.string().min(1).optional(),
  description: external_exports.string().min(1).optional(),
  trigger: external_exports.string().min(1).optional(),
  root: external_exports.string().min(1),
  path: external_exports.string().min(1),
  sha256: external_exports.string().regex(HEX64),
  bytes: external_exports.number().int().nonnegative()
}).strict();
var SkillSlot = external_exports.object({
  id: SkillSlotId,
  description: external_exports.string().min(1)
}).strict();
var SkillSlotArray = external_exports.array(SkillSlot).superRefine((slots, ctx) => {
  const seen = /* @__PURE__ */ new Set();
  for (const [index, slot] of slots.entries()) {
    const key = slot.id;
    if (seen.has(key)) {
      ctx.addIssue({
        code: external_exports.ZodIssueCode.custom,
        path: [index, "id"],
        message: `duplicate skill slot '${key}'`
      });
    }
    seen.add(key);
  }
});

// dist/schemas/step.js
var RelayRole = external_exports.enum(["researcher", "implementer", "reviewer"]);
var ReportRef = external_exports.object({
  path: RunRelativePath,
  schema: external_exports.string().min(1)
});
var StepBase = external_exports.object({
  id: StepId,
  title: external_exports.string().min(1),
  protocol: ProtocolId,
  reads: external_exports.array(RunRelativePath).default([]),
  routes: external_exports.record(external_exports.string(), external_exports.string()).refine((m) => Object.keys(m).length > 0, {
    message: "Step must declare at least one route (including `@complete`)."
  }),
  selection: SelectionOverride.optional(),
  skill_slots: SkillSlotArray.optional(),
  budgets: external_exports.object({
    max_attempts: external_exports.number().int().positive().max(10),
    wall_clock_ms: external_exports.number().int().positive().optional()
  }).optional()
});
var ComposeStep = StepBase.extend({
  executor: external_exports.literal("orchestrator"),
  kind: external_exports.literal("compose"),
  writes: external_exports.object({
    report: ReportRef
  }).strict(),
  check: SchemaSectionsCheck
}).strict();
var VerificationStep = StepBase.extend({
  executor: external_exports.literal("orchestrator"),
  kind: external_exports.literal("verification"),
  writes: external_exports.object({
    report: ReportRef
  }).strict(),
  check: SchemaSectionsCheck
}).strict();
var CheckpointPolicy = external_exports.object({
  prompt: external_exports.string().min(1),
  choices: external_exports.array(external_exports.object({
    id: external_exports.string().min(1),
    label: external_exports.string().min(1).optional(),
    description: external_exports.string().min(1).optional()
  }).strict()).min(1),
  safe_default_choice: external_exports.string().min(1).optional(),
  safe_autonomous_choice: external_exports.string().min(1).optional(),
  report_template: JsonObject.optional()
}).strict().superRefine((policy2, ctx) => {
  const choiceIds = /* @__PURE__ */ new Set();
  for (const [index, choice] of policy2.choices.entries()) {
    if (choiceIds.has(choice.id)) {
      ctx.addIssue({
        code: external_exports.ZodIssueCode.custom,
        path: ["choices", index, "id"],
        message: `duplicate checkpoint choice '${choice.id}'`
      });
    }
    choiceIds.add(choice.id);
  }
  for (const [field, value] of [
    ["safe_default_choice", policy2.safe_default_choice],
    ["safe_autonomous_choice", policy2.safe_autonomous_choice]
  ]) {
    if (value !== void 0 && !choiceIds.has(value)) {
      ctx.addIssue({
        code: external_exports.ZodIssueCode.custom,
        path: [field],
        message: `${field} must reference a declared checkpoint choice`
      });
    }
  }
});
var CheckpointStep = StepBase.extend({
  executor: external_exports.literal("orchestrator"),
  kind: external_exports.literal("checkpoint"),
  policy: CheckpointPolicy,
  writes: external_exports.object({
    request: RunRelativePath,
    response: RunRelativePath,
    report: ReportRef.optional()
  }).strict(),
  check: CheckpointSelectionCheck
}).strict();
var RelayStep = StepBase.extend({
  executor: external_exports.literal("worker"),
  kind: external_exports.literal("relay"),
  role: RelayRole,
  writes: external_exports.object({
    report: ReportRef.optional(),
    request: RunRelativePath,
    receipt: RunRelativePath,
    result: RunRelativePath
  }).strict(),
  check: ResultVerdictCheck
}).strict();
var CompiledFlowRef = external_exports.object({
  flow_id: CompiledFlowId,
  entry_mode: external_exports.string().regex(/^[a-z][a-z0-9-]*$/, { message: "entry_mode must be a kebab-case slug" }),
  // Optional pin to a specific schematic version. Default is the version
  // resolved by the schematic loader at child-bootstrap time.
  version: external_exports.string().min(1).optional()
}).strict();
var SubRunStep = StepBase.extend({
  executor: external_exports.literal("orchestrator"),
  kind: external_exports.literal("sub-run"),
  flow_ref: CompiledFlowRef,
  // Goal string handed to the child flow at bootstrap. Templating is
  // a runtime concern (e.g., `$upstream_report.field` substitution) that
  // resolves before child bootstrap; the schema accepts a plain string.
  goal: external_exports.string().min(1),
  depth: Depth,
  writes: external_exports.object({
    // The child run's terminal result.json copied into the parent's
    // run-folder after the child closes. The parent check reads this slot.
    result: RunRelativePath,
    // Optional materialized child report (e.g., child build-result.json
    // republished verbatim into a parent slot for downstream readers).
    report: ReportRef.optional()
  }).strict(),
  check: ResultVerdictCheck
}).strict();
var FANOUT_BRANCH_ID_REGEX = /^[a-z0-9][a-z0-9-]*$/;
var FanoutSubRunBranch = external_exports.object({
  // Branch identifier; unique across the fanout's branches. Used to
  // derive the per-branch worktree name and the per-branch result
  // directory under `writes.branches_dir/<branch_id>/`.
  branch_id: external_exports.string().min(1).max(64).regex(FANOUT_BRANCH_ID_REGEX, { message: "branch_id must be a kebab-case slug" }),
  flow_ref: CompiledFlowRef,
  goal: external_exports.string().min(1),
  depth: Depth,
  // Per-branch selection override — useful for tournament-style fanouts
  // where the variation is in connector / model selection, not flow.
  selection: SelectionOverride.optional()
}).strict();
var FanoutRelayBranchExecution = external_exports.object({
  kind: external_exports.literal("relay"),
  role: RelayRole,
  goal: external_exports.string().min(1),
  report_schema: external_exports.string().min(1),
  provenance_field: external_exports.string().regex(/^[a-z_][a-z0-9_]*$/i, {
    message: "provenance_field must be a top-level JSON field name"
  }).optional()
}).strict();
var FanoutRelayBranch = external_exports.object({
  branch_id: external_exports.string().min(1).max(64).regex(FANOUT_BRANCH_ID_REGEX, { message: "branch_id must be a kebab-case slug" }),
  execution: FanoutRelayBranchExecution,
  selection: SelectionOverride.optional()
}).strict();
var FanoutBranch = external_exports.union([FanoutSubRunBranch, FanoutRelayBranch]);
var FanoutSubRunBranchTemplate = external_exports.object({
  branch_id: external_exports.string().min(1).max(64),
  flow_ref: CompiledFlowRef,
  goal: external_exports.string().min(1),
  depth: Depth,
  selection: SelectionOverride.optional()
}).strict();
var FanoutRelayBranchTemplate = external_exports.object({
  branch_id: external_exports.string().min(1).max(64),
  execution: FanoutRelayBranchExecution,
  selection: SelectionOverride.optional()
}).strict();
var FanoutBranchTemplate = external_exports.union([
  FanoutSubRunBranchTemplate,
  FanoutRelayBranchTemplate
]);
var FanoutBranchesStatic = external_exports.object({
  kind: external_exports.literal("static"),
  // Author lists every branch upfront. Used by tournaments (N attempts at
  // one flow, varying selection / depth) and small fixed crucibles.
  branches: external_exports.array(FanoutBranch).min(1).max(64)
}).strict();
var FanoutBranchesDynamic = external_exports.object({
  kind: external_exports.literal("dynamic"),
  // Branches computed at runtime from an upstream report. Authors
  // declare the source report + a JSONPath-like dotted path to the
  // iterable + a template branch with `$item.<field>` placeholders.
  // Runtime expands the template per item at fanout.start time and
  // re-parses each expansion through FanoutBranch (strict regex).
  //
  // Used by Migrate where batch count is determined by inventory.
  source_report: RunRelativePath,
  items_path: external_exports.string().min(1),
  template: FanoutBranchTemplate,
  // Hard cap to prevent runaway fanouts when the source report is
  // unexpectedly large.
  max_branches: external_exports.number().int().positive().max(256).default(16)
}).strict();
var FanoutBranches = external_exports.discriminatedUnion("kind", [
  FanoutBranchesStatic,
  FanoutBranchesDynamic
]);
var FanoutConcurrency = external_exports.discriminatedUnion("kind", [
  external_exports.object({ kind: external_exports.literal("unbounded") }).strict(),
  external_exports.object({
    kind: external_exports.literal("bounded"),
    max: external_exports.number().int().positive().max(64)
  }).strict()
]);
var FanoutFailurePolicy = external_exports.enum(["abort-all", "continue-others"]);
var FanoutStep = StepBase.extend({
  executor: external_exports.literal("orchestrator"),
  kind: external_exports.literal("fanout"),
  branches: FanoutBranches,
  // Default bounded(4) keeps disk and rate-limit pressure sane on
  // unattended runs. Authors who know their parallelism budget can opt
  // into unbounded explicitly.
  concurrency: FanoutConcurrency.default({ kind: "bounded", max: 4 }),
  on_child_failure: FanoutFailurePolicy.default("abort-all"),
  writes: external_exports.object({
    // Parent directory under which the runtime materialises each
    // branch's result.json at `<branches_dir>/<branch_id>/result.json`.
    // The directory is runtime-owned; schematic authors declare its location.
    branches_dir: RunRelativePath,
    // Aggregate report summarising all child results, built by the
    // runtime after join. This is the slot the check reads.
    aggregate: ReportRef
  }).strict(),
  check: FanoutAggregateCheck
}).strict();
var Step = external_exports.discriminatedUnion("kind", [
  ComposeStep,
  VerificationStep,
  CheckpointStep,
  RelayStep,
  SubRunStep,
  FanoutStep
]).superRefine((step, ctx) => {
  const slot = step.check.source.ref;
  const writes = step.writes;
  if (!Object.hasOwn(writes, slot) || writes[slot] === void 0) {
    ctx.addIssue({
      code: external_exports.ZodIssueCode.custom,
      path: ["check", "source", "ref"],
      message: `check.source.ref "${slot}" does not resolve to a usable slot in step.writes (available: ${Object.keys(writes).join(", ")})`
    });
  }
  if (step.kind === "checkpoint") {
    const policyChoiceIds = step.policy.choices.map((choice) => choice.id).sort();
    const checkChoiceIds = [...step.check.allow].sort();
    if (policyChoiceIds.join("\0") !== checkChoiceIds.join("\0")) {
      ctx.addIssue({
        code: external_exports.ZodIssueCode.custom,
        path: ["check", "allow"],
        message: "checkpoint check.allow must exactly match policy.choices ids"
      });
    }
    if (step.writes.report !== void 0) {
      if (step.policy.report_template === void 0) {
        ctx.addIssue({
          code: external_exports.ZodIssueCode.custom,
          path: ["policy", "report_template"],
          message: "checkpoint report writing requires policy.report_template"
        });
      }
    }
  }
  if (step.kind === "fanout") {
    if (step.branches.kind === "static") {
      const seen = /* @__PURE__ */ new Set();
      for (let i = 0; i < step.branches.branches.length; i++) {
        const branch = step.branches.branches[i];
        if (branch === void 0)
          continue;
        if (seen.has(branch.branch_id)) {
          ctx.addIssue({
            code: external_exports.ZodIssueCode.custom,
            path: ["branches", "branches", i, "branch_id"],
            message: `duplicate branch_id '${branch.branch_id}'`
          });
        } else {
          seen.add(branch.branch_id);
        }
      }
    }
    if (step.branches.kind === "dynamic") {
      if (!step.branches.template.branch_id.includes("$item")) {
        ctx.addIssue({
          code: external_exports.ZodIssueCode.custom,
          path: ["branches", "template", "branch_id"],
          message: "dynamic fanout template.branch_id must contain `$item` placeholder so per-item expansion produces unique branch ids"
        });
      }
    }
  }
});
var RouteMap = StepBase.shape.routes;

// dist/schemas/connector.js
var EnabledConnector = external_exports.enum(["claude-code", "codex"]);
var FilesystemCapability = external_exports.enum(["read-only", "trusted-write", "isolated-write"]);
var StructuredOutputCapability = external_exports.enum(["json"]);
var ConnectorCapabilities = external_exports.object({
  filesystem: FilesystemCapability,
  structured_output: StructuredOutputCapability
}).strict();
var PromptTransport = external_exports.enum(["prompt-file"]);
var ConnectorOutputExtraction = external_exports.object({
  kind: external_exports.literal("output-file")
}).strict();
var BUILTIN_CONNECTOR_CAPABILITIES = {
  "claude-code": { filesystem: "trusted-write", structured_output: "json" },
  codex: { filesystem: "read-only", structured_output: "json" }
};
var RESERVED_ADAPTER_NAMES = [
  ...EnabledConnector.options,
  "auto"
];
var ConnectorName = external_exports.string().regex(/^[a-z][a-z0-9-]*$/);
var CustomConnectorDescriptor = external_exports.object({
  kind: external_exports.literal("custom"),
  name: ConnectorName,
  command: external_exports.array(external_exports.string().min(1)).min(1),
  prompt_transport: PromptTransport,
  output: ConnectorOutputExtraction,
  capabilities: ConnectorCapabilities
}).strict().superRefine((descriptor, ctx) => {
  if (descriptor.capabilities.filesystem !== "read-only") {
    ctx.addIssue({
      code: external_exports.ZodIssueCode.custom,
      path: ["capabilities", "filesystem"],
      message: "custom connectors are read-only in V1; writable custom workers require a later isolated mode"
    });
  }
});
var BuiltInConnectorRef = external_exports.object({
  kind: external_exports.literal("builtin"),
  name: EnabledConnector
}).strict();
var NamedConnectorRef = external_exports.object({
  kind: external_exports.literal("named"),
  name: ConnectorName
}).strict();
var ConnectorRef = external_exports.union([
  BuiltInConnectorRef,
  NamedConnectorRef,
  CustomConnectorDescriptor
]);
var ResolvedConnector = external_exports.union([BuiltInConnectorRef, CustomConnectorDescriptor]);
var ExplicitResolutionSource = external_exports.object({ source: external_exports.literal("explicit") }).strict();
var RoleResolutionSource = external_exports.object({ source: external_exports.literal("role"), role: RelayRole }).strict();
var CircuitResolutionSource = external_exports.object({ source: external_exports.literal("circuit"), flow_id: CompiledFlowId }).strict();
var DefaultResolutionSource = external_exports.object({ source: external_exports.literal("default") }).strict();
var AutoResolutionSource = external_exports.object({ source: external_exports.literal("auto") }).strict();
var RelayResolutionSource = external_exports.discriminatedUnion("source", [
  ExplicitResolutionSource,
  RoleResolutionSource,
  CircuitResolutionSource,
  DefaultResolutionSource,
  AutoResolutionSource
]);

// dist/schemas/trace-entry.js
var TraceEntryBase = external_exports.object({
  schema_version: external_exports.literal(1),
  sequence: external_exports.number().int().nonnegative(),
  recorded_at: external_exports.string().datetime(),
  run_id: RunId
});
var HEX642 = /^[0-9a-f]{64}$/;
var ContentHash = external_exports.string().regex(HEX642, {
  message: "must be a 64-character lowercase hex SHA-256 digest"
});
var RunBootstrappedTraceEntry = TraceEntryBase.extend({
  kind: external_exports.literal("run.bootstrapped"),
  flow_id: CompiledFlowId,
  invocation_id: InvocationId.optional(),
  depth: Depth,
  goal: external_exports.string().min(1),
  change_kind: ChangeKindDeclaration,
  manifest_hash: external_exports.string().min(1)
}).strict();
var StepEnteredTraceEntry = TraceEntryBase.extend({
  kind: external_exports.literal("step.entered"),
  step_id: StepId,
  attempt: external_exports.number().int().positive()
}).strict();
var StepReportWrittenTraceEntry = TraceEntryBase.extend({
  kind: external_exports.literal("step.report_written"),
  step_id: StepId,
  attempt: external_exports.number().int().positive(),
  report_path: external_exports.string().min(1),
  report_schema: external_exports.string().min(1)
}).strict();
var CheckEvaluatedTraceEntry = TraceEntryBase.extend({
  kind: external_exports.literal("check.evaluated"),
  step_id: StepId,
  attempt: external_exports.number().int().positive(),
  check_kind: external_exports.enum([
    "schema_sections",
    "checkpoint_selection",
    "result_verdict",
    "fanout_aggregate"
  ]),
  outcome: external_exports.enum(["pass", "fail"]),
  missing_sections: external_exports.array(external_exports.string()).optional(),
  reason: external_exports.string().optional()
}).strict();
var CheckpointRequestedTraceEntry = TraceEntryBase.extend({
  kind: external_exports.literal("checkpoint.requested"),
  step_id: StepId,
  attempt: external_exports.number().int().positive(),
  options: external_exports.array(external_exports.string()).min(1),
  request_path: external_exports.string().min(1),
  request_report_hash: ContentHash
}).strict();
var CheckpointResolvedTraceEntry = TraceEntryBase.extend({
  kind: external_exports.literal("checkpoint.resolved"),
  step_id: StepId,
  attempt: external_exports.number().int().positive(),
  selection: external_exports.string().min(1),
  auto_resolved: external_exports.boolean(),
  resolution_source: external_exports.enum(["safe-default", "operator", "safe-autonomous"]),
  response_path: external_exports.string().min(1)
}).strict();
var RelayStartedTraceEntry = TraceEntryBase.extend({
  kind: external_exports.literal("relay.started"),
  step_id: StepId,
  attempt: external_exports.number().int().positive(),
  connector: ResolvedConnector,
  role: RelayRole,
  resolved_selection: ResolvedSelection,
  resolved_from: RelayResolutionSource
}).strict();
var LoadedSkillEvidence = external_exports.object({
  id: SkillId,
  slot: SkillSlotId.optional(),
  path: external_exports.string().min(1),
  sha256: ContentHash,
  bytes: external_exports.number().int().nonnegative()
}).strict();
var SkillsLoadedTraceEntry = TraceEntryBase.extend({
  kind: external_exports.literal("skills.loaded"),
  step_id: StepId,
  attempt: external_exports.number().int().positive(),
  skills: external_exports.array(LoadedSkillEvidence).min(1)
}).strict();
var RelayCompletedTraceEntry = TraceEntryBase.extend({
  kind: external_exports.literal("relay.completed"),
  step_id: StepId,
  attempt: external_exports.number().int().positive(),
  verdict: external_exports.string().min(1),
  duration_ms: external_exports.number().int().nonnegative(),
  result_path: external_exports.string().min(1),
  receipt_path: external_exports.string().min(1)
}).strict();
var RelayRequestTraceEntry = TraceEntryBase.extend({
  kind: external_exports.literal("relay.request"),
  step_id: StepId,
  attempt: external_exports.number().int().positive(),
  request_payload_hash: ContentHash
}).strict();
var RelayFailedTraceEntry = TraceEntryBase.extend({
  kind: external_exports.literal("relay.failed"),
  step_id: StepId,
  attempt: external_exports.number().int().positive(),
  connector: ResolvedConnector,
  role: RelayRole,
  resolved_selection: ResolvedSelection,
  resolved_from: RelayResolutionSource,
  request_payload_hash: ContentHash,
  reason: external_exports.string().min(1)
}).strict();
var RelayReceiptTraceEntry = TraceEntryBase.extend({
  kind: external_exports.literal("relay.receipt"),
  step_id: StepId,
  attempt: external_exports.number().int().positive(),
  cli_version: external_exports.string().min(1),
  receipt_id: external_exports.string().min(1).refine((s) => s.trim().length > 0, {
    message: "receipt_id must contain at least one non-whitespace character"
  })
}).strict();
var RelayResultTraceEntry = TraceEntryBase.extend({
  kind: external_exports.literal("relay.result"),
  step_id: StepId,
  attempt: external_exports.number().int().positive(),
  result_report_hash: ContentHash
}).strict();
var StepCompletedTraceEntry = TraceEntryBase.extend({
  kind: external_exports.literal("step.completed"),
  step_id: StepId,
  attempt: external_exports.number().int().positive(),
  route_taken: external_exports.string().min(1)
}).strict();
var StepAbortedTraceEntry = TraceEntryBase.extend({
  kind: external_exports.literal("step.aborted"),
  step_id: StepId,
  attempt: external_exports.number().int().positive(),
  reason: external_exports.string().min(1)
}).strict();
var RunClosedOutcome = external_exports.enum(["complete", "aborted", "handoff", "stopped", "escalated"]);
var SubRunStartedTraceEntry = TraceEntryBase.extend({
  kind: external_exports.literal("sub_run.started"),
  step_id: StepId,
  attempt: external_exports.number().int().positive(),
  child_run_id: RunId,
  child_flow_id: CompiledFlowId,
  child_entry_mode: external_exports.string().regex(/^[a-z][a-z0-9-]*$/),
  child_depth: Depth
}).strict();
var SubRunCompletedTraceEntry = TraceEntryBase.extend({
  kind: external_exports.literal("sub_run.completed"),
  step_id: StepId,
  attempt: external_exports.number().int().positive(),
  child_run_id: RunId,
  child_outcome: RunClosedOutcome,
  // Verdict admitted from the child's terminal result body. NO_VERDICT_SENTINEL
  // when the child closed without a parseable result body — mirrors the
  // existing relay.completed sentinel pattern.
  verdict: external_exports.string().min(1),
  duration_ms: external_exports.number().int().nonnegative(),
  // Where the child's result.json was copied into the parent run-folder.
  result_path: external_exports.string().min(1)
}).strict();
var FanoutStartedTraceEntry = TraceEntryBase.extend({
  kind: external_exports.literal("fanout.started"),
  step_id: StepId,
  attempt: external_exports.number().int().positive(),
  // Resolved branch list AT EXPANSION TIME. For static branches this
  // mirrors the schematic's authored list. For dynamic branches this is the
  // result of template expansion against the source report, so an
  // auditor can see exactly which N branches were spawned without
  // reconstructing the expansion themselves.
  branch_ids: external_exports.array(external_exports.string().min(1)).min(1),
  on_child_failure: FanoutFailurePolicy
}).strict();
var FanoutBranchStartedTraceEntry = TraceEntryBase.extend({
  kind: external_exports.literal("fanout.branch_started"),
  step_id: StepId,
  attempt: external_exports.number().int().positive(),
  branch_id: external_exports.string().min(1),
  branch_kind: external_exports.enum(["relay", "sub-run"]),
  child_run_id: RunId,
  // Worktree path provisioned for this branch (relative to project root).
  // Records where the per-branch isolation lived for postmortem auditing.
  worktree_path: external_exports.string().min(1)
}).strict();
var FanoutBranchCompletedTraceEntry = TraceEntryBase.extend({
  kind: external_exports.literal("fanout.branch_completed"),
  step_id: StepId,
  attempt: external_exports.number().int().positive(),
  branch_id: external_exports.string().min(1),
  branch_kind: external_exports.enum(["relay", "sub-run"]),
  child_run_id: RunId,
  child_outcome: RunClosedOutcome,
  verdict: external_exports.string().min(1),
  duration_ms: external_exports.number().int().nonnegative(),
  result_path: external_exports.string().min(1)
}).strict();
var FanoutJoinedTraceEntry = TraceEntryBase.extend({
  kind: external_exports.literal("fanout.joined"),
  step_id: StepId,
  attempt: external_exports.number().int().positive(),
  // The join policy that ran; mirrors the FanoutAggregateCheck.join.policy
  // field but echoed into the trace_entry so the audit log is self-contained
  // (no need to cross-reference the schematic to interpret outcomes).
  policy: external_exports.enum(["pick-winner", "disjoint-merge", "aggregate-only"]),
  // For pick-winner: the selected branch_id. Absent for the other policies.
  selected_branch_id: external_exports.string().min(1).optional(),
  // Path to the runtime-built aggregate report.
  aggregate_path: external_exports.string().min(1),
  // Count of branches that closed 'complete' vs other outcomes — quick
  // health summary readable without reconstructing per-branch trace_entries.
  branches_completed: external_exports.number().int().nonnegative(),
  branches_failed: external_exports.number().int().nonnegative()
}).strict();
var RunClosedTraceEntry = TraceEntryBase.extend({
  kind: external_exports.literal("run.closed"),
  outcome: RunClosedOutcome,
  reason: external_exports.string().optional()
}).strict();
var TraceEntry = external_exports.discriminatedUnion("kind", [
  RunBootstrappedTraceEntry,
  StepEnteredTraceEntry,
  StepReportWrittenTraceEntry,
  CheckEvaluatedTraceEntry,
  CheckpointRequestedTraceEntry,
  CheckpointResolvedTraceEntry,
  RelayStartedTraceEntry,
  SkillsLoadedTraceEntry,
  RelayRequestTraceEntry,
  RelayFailedTraceEntry,
  RelayReceiptTraceEntry,
  RelayResultTraceEntry,
  RelayCompletedTraceEntry,
  SubRunStartedTraceEntry,
  SubRunCompletedTraceEntry,
  FanoutStartedTraceEntry,
  FanoutBranchStartedTraceEntry,
  FanoutBranchCompletedTraceEntry,
  FanoutJoinedTraceEntry,
  StepCompletedTraceEntry,
  StepAbortedTraceEntry,
  RunClosedTraceEntry
]).superRefine((ev, ctx) => {
  if (ev.kind !== "relay.started" && ev.kind !== "relay.failed")
    return;
  if (ev.resolved_from.source === "role" && ev.resolved_from.role !== ev.role) {
    ctx.addIssue({
      code: external_exports.ZodIssueCode.custom,
      path: ["resolved_from", "role"],
      message: `resolved_from.role '${ev.resolved_from.role}' does not agree with trace_entry role '${ev.role}'`
    });
  }
});

// dist/schemas/result.js
var RunResult = external_exports.object({
  schema_version: external_exports.literal(1),
  run_id: RunId,
  flow_id: CompiledFlowId,
  goal: external_exports.string().min(1),
  outcome: RunClosedOutcome,
  summary: external_exports.string().min(1),
  closed_at: external_exports.string().datetime(),
  trace_entries_observed: external_exports.number().int().nonnegative(),
  manifest_hash: external_exports.string().min(1),
  reason: external_exports.string().min(1).optional(),
  verdict: external_exports.string().min(1).optional()
}).strict();

// dist/flows/migrate/reports.js
var MIGRATE_RESULT_SCHEMA_BY_ARTIFACT_ID = {
  "migrate.brief": "migrate.brief@v1",
  "migrate.inventory": "migrate.inventory@v1",
  "migrate.coexistence": "migrate.coexistence@v1",
  "migrate.batch": "migrate.batch@v1",
  "migrate.verification": "migrate.verification@v1",
  "migrate.review": "migrate.review@v1"
};
var NonEmptyStringArray3 = external_exports.array(external_exports.string().min(1)).min(1);
var MigrateBrief = external_exports.object({
  objective: external_exports.string().min(1),
  source: external_exports.string().min(1),
  target: external_exports.string().min(1),
  scope: external_exports.string().min(1),
  success_criteria: NonEmptyStringArray3,
  coexistence_appetite: external_exports.enum(["none", "short-window", "open-ended"]),
  rollback_plan: external_exports.string().min(1),
  verification_command_candidates: external_exports.array(VerificationCommand).min(1)
}).strict();
var MigrateInventoryItem = external_exports.object({
  id: external_exports.string().min(1),
  path: external_exports.string().min(1),
  category: external_exports.string().min(1),
  description: external_exports.string().min(1)
}).strict();
var MigrateBatchPlan = external_exports.object({
  id: external_exports.string().min(1),
  title: external_exports.string().min(1),
  item_ids: NonEmptyStringArray3,
  rationale: external_exports.string().min(1)
}).strict();
var MigrateInventory = external_exports.object({
  verdict: external_exports.literal("accept"),
  summary: external_exports.string().min(1),
  items: external_exports.array(MigrateInventoryItem).min(1),
  batches: external_exports.array(MigrateBatchPlan).min(1)
}).strict().superRefine((inventory, ctx) => {
  const itemIds = /* @__PURE__ */ new Set();
  for (const [index, item] of inventory.items.entries()) {
    if (itemIds.has(item.id)) {
      ctx.addIssue({
        code: external_exports.ZodIssueCode.custom,
        path: ["items", index, "id"],
        message: `duplicate inventory item id: ${item.id}`
      });
    }
    itemIds.add(item.id);
  }
  const batchIds = /* @__PURE__ */ new Set();
  for (const [batchIndex, batch] of inventory.batches.entries()) {
    if (batchIds.has(batch.id)) {
      ctx.addIssue({
        code: external_exports.ZodIssueCode.custom,
        path: ["batches", batchIndex, "id"],
        message: `duplicate batch id: ${batch.id}`
      });
    }
    batchIds.add(batch.id);
    for (const [itemIndex, itemId] of batch.item_ids.entries()) {
      if (!itemIds.has(itemId)) {
        ctx.addIssue({
          code: external_exports.ZodIssueCode.custom,
          path: ["batches", batchIndex, "item_ids", itemIndex],
          message: `batch '${batch.id}' references unknown inventory item id: ${itemId}`
        });
      }
    }
  }
});
var MigrateCoexistence = external_exports.object({
  strategy: external_exports.string().min(1),
  switchover_criteria: NonEmptyStringArray3,
  health_signals: NonEmptyStringArray3,
  rollback_path: external_exports.string().min(1),
  risks: external_exports.array(external_exports.string().min(1))
}).strict();
var MigrateBatch = RunResult;
var MigrateVerification = VerificationResult;
var MigrateReviewVerdict = external_exports.enum([
  "release-approved",
  "release-with-followups",
  "release-blocked",
  "reject"
]);
var MigrateReviewFinding = external_exports.object({
  severity: external_exports.enum(["critical", "high", "medium", "low"]),
  text: external_exports.string().min(1),
  file_refs: external_exports.array(external_exports.string().min(1))
}).strict();
var MigrateReview = external_exports.object({
  verdict: MigrateReviewVerdict,
  summary: external_exports.string().min(1),
  findings: external_exports.array(MigrateReviewFinding)
}).strict().superRefine((review, ctx) => {
  if (review.verdict !== "release-approved" && review.findings.length === 0) {
    ctx.addIssue({
      code: external_exports.ZodIssueCode.custom,
      path: ["findings"],
      message: `findings must be non-empty when verdict is '${review.verdict}'`
    });
  }
});
var MigrateResultOutcome = external_exports.enum(["complete", "release-deferred", "reverted", "failed"]);
var MigrateResultReportId = external_exports.enum([
  "migrate.brief",
  "migrate.inventory",
  "migrate.coexistence",
  "migrate.batch",
  "migrate.verification",
  "migrate.review"
]);
var MigrateResultReportPointer = external_exports.object({
  report_id: MigrateResultReportId,
  path: external_exports.string().min(1),
  schema: external_exports.string().min(1)
}).strict().superRefine((pointer, ctx) => {
  const expectedSchema = MIGRATE_RESULT_SCHEMA_BY_ARTIFACT_ID[pointer.report_id];
  if (pointer.schema !== expectedSchema) {
    ctx.addIssue({
      code: external_exports.ZodIssueCode.custom,
      path: ["schema"],
      message: `schema must be '${expectedSchema}' for report_id '${pointer.report_id}'`
    });
  }
});
var MigrateResult = external_exports.object({
  summary: external_exports.string().min(1),
  outcome: MigrateResultOutcome,
  verification_status: external_exports.enum(["passed", "failed"]),
  review_verdict: MigrateReviewVerdict,
  batch_count: external_exports.number().int().nonnegative(),
  evidence_links: external_exports.array(MigrateResultReportPointer).length(6)
}).strict().superRefine((result, ctx) => {
  const seen = /* @__PURE__ */ new Set();
  for (const [index, pointer] of result.evidence_links.entries()) {
    if (seen.has(pointer.report_id)) {
      ctx.addIssue({
        code: external_exports.ZodIssueCode.custom,
        path: ["evidence_links", index, "report_id"],
        message: `duplicate report_id '${pointer.report_id}'`
      });
    }
    seen.add(pointer.report_id);
  }
  for (const reportId of MigrateResultReportId.options) {
    if (!seen.has(reportId)) {
      ctx.addIssue({
        code: external_exports.ZodIssueCode.custom,
        path: ["evidence_links"],
        message: `missing report_id '${reportId}'`
      });
    }
  }
});

// dist/flows/migrate/writers/brief.js
var DEFAULT_MIGRATE_VERIFICATION_COMMAND = {
  id: "migrate-proof",
  cwd: ".",
  argv: ["npm", "run", "check"],
  timeout_ms: 12e4,
  max_output_bytes: 2e5,
  env: {}
};
var migrateBriefComposeBuilder = {
  resultSchemaName: "migrate.brief@v1",
  build(context) {
    const goal = context.goal;
    return MigrateBrief.parse({
      objective: goal,
      source: `Existing implementation referenced by: ${goal}`,
      target: `Replacement implementation requested by: ${goal}`,
      scope: goal,
      success_criteria: [`Demonstrate the migration addresses: ${goal}`],
      coexistence_appetite: "short-window",
      rollback_plan: "Revert the batch sub-run commit; the pre-migration source still works because coexistence kept it in place.",
      verification_command_candidates: [DEFAULT_MIGRATE_VERIFICATION_COMMAND]
    });
  }
};

// dist/flows/migrate/writers/close.js
var POINTERS3 = [
  { report_id: "migrate.brief", schema: "migrate.brief@v1" },
  { report_id: "migrate.inventory", schema: "migrate.inventory@v1" },
  { report_id: "migrate.coexistence", schema: "migrate.coexistence@v1" },
  { report_id: "migrate.batch", schema: "migrate.batch@v1" },
  { report_id: "migrate.verification", schema: "migrate.verification@v1" },
  { report_id: "migrate.review", schema: "migrate.review@v1" }
];
var migrateCloseBuilder = {
  resultSchemaName: "migrate.result@v1",
  reads: [
    { name: "brief", schema: "migrate.brief@v1", required: true },
    { name: "inventory", schema: "migrate.inventory@v1", required: true },
    { name: "coexistence", schema: "migrate.coexistence@v1", required: true },
    { name: "batch", schema: "migrate.batch@v1", required: true },
    { name: "verification", schema: "migrate.verification@v1", required: true },
    { name: "review", schema: "migrate.review@v1", required: true }
  ],
  build(context) {
    const brief = MigrateBrief.parse(context.inputs.brief);
    const inventory = MigrateInventory.parse(context.inputs.inventory);
    MigrateCoexistence.parse(context.inputs.coexistence);
    const batch = MigrateBatch.parse(context.inputs.batch);
    const verification = MigrateVerification.parse(context.inputs.verification);
    const review = MigrateReview.parse(context.inputs.review);
    const verificationOk = verification.overall_status === "passed";
    const childComplete = batch.outcome === "complete";
    const outcome = !childComplete ? "reverted" : !verificationOk || review.verdict === "reject" || review.verdict === "release-blocked" ? "failed" : review.verdict === "release-with-followups" ? "release-deferred" : "complete";
    return MigrateResult.parse({
      summary: `Migrate result for ${brief.objective}: ${review.summary}`,
      outcome,
      verification_status: verification.overall_status,
      review_verdict: review.verdict,
      batch_count: inventory.batches.length,
      evidence_links: POINTERS3.map((p) => ({
        ...p,
        path: reportPathForSchemaInCompiledFlow(context.flow, p.schema)
      }))
    });
  }
};

// dist/flows/migrate/writers/coexistence.js
var migrateCoexistenceComposeBuilder = {
  resultSchemaName: "migrate.coexistence@v1",
  reads: [
    { name: "brief", schema: "migrate.brief@v1", required: true },
    { name: "inventory", schema: "migrate.inventory@v1", required: true }
  ],
  build(context) {
    const brief = MigrateBrief.parse(context.inputs.brief);
    const inventory = MigrateInventory.parse(context.inputs.inventory);
    return MigrateCoexistence.parse({
      strategy: `${brief.coexistence_appetite} window: keep ${brief.source} in place while ${brief.target} is rolled out batch by batch (${inventory.batches.length} batch(es) planned).`,
      switchover_criteria: [
        "All declared inventory items have been touched and verification passes.",
        "Release review verdict is release-approved or release-with-followups."
      ],
      health_signals: [
        `Verification command suite (${brief.verification_command_candidates.map((c) => c.id).join(", ")}) reports passed.`,
        "No regressions reported by the release review."
      ],
      rollback_path: brief.rollback_plan,
      risks: [
        "Single-batch v0 has no per-batch isolation \u2014 a partial failure rolls back the entire run."
      ]
    });
  }
};

// dist/flows/migrate/writers/verification.js
import { readFileSync as readFileSync6 } from "node:fs";
var migrateVerificationWriter = {
  resultSchemaName: "migrate.verification@v1",
  loadCommands(context) {
    const briefPath = reportPathForSchemaInCompiledFlow(context.flow, "migrate.brief@v1");
    if (!context.step.reads.includes(briefPath)) {
      throw new Error(`migrate.verification@v1 requires step '${context.step.id}' to read ${briefPath}`);
    }
    const brief = MigrateBrief.parse(JSON.parse(readFileSync6(resolveRunRelative(context.runFolder, briefPath), "utf8")));
    return brief.verification_command_candidates;
  },
  buildResult(observations) {
    const overallStatus = observations.some((o) => o.status === "failed") ? "failed" : "passed";
    return MigrateVerification.parse({
      overall_status: overallStatus,
      commands: observations.map((o) => ({
        command_id: o.command.id,
        argv: o.command.argv,
        cwd: o.command.cwd,
        exit_code: o.exit_code,
        status: o.status,
        duration_ms: o.duration_ms,
        stdout_summary: o.stdout_summary,
        stderr_summary: o.stderr_summary
      }))
    });
  }
};

// dist/flows/migrate/index.js
var MIGRATE_SIGNALS = [
  { label: "migrate prefix", pattern: /^\s*migrate\s*:/i },
  {
    label: "migrate request",
    pattern: /^\s*(?:please\s+)?(?:migrate|port|swap|replace|rewrite|transition)\s+(?:a\s+|an\s+|the\s+|this\s+|that\s+|my\s+|all\s+|our\s+)?\S+/i
  },
  {
    label: "framework swap signal",
    pattern: /\b(?:framework|library|dependency|stack)\s+(?:swap|replacement|migration)\b/i
  }
];
var migrateCompiledFlowPackage = {
  id: "migrate",
  visibility: "public",
  paths: {
    schematic: "src/flows/migrate/schematic.json"
  },
  routing: {
    order: 10,
    signals: MIGRATE_SIGNALS,
    skipOnPlanningReport: true,
    reasonForMatch(signal) {
      return `matched ${signal.label}; routed to Migrate flow`;
    }
  },
  relayReports: [
    {
      schemaName: "migrate.inventory@v1",
      schema: MigrateInventory,
      relayHint: migrateInventoryShapeHint.instruction
    },
    {
      schemaName: "migrate.review@v1",
      schema: MigrateReview,
      relayHint: migrateReviewShapeHint.instruction
    }
  ],
  reportSchemas: [
    { schemaName: "migrate.brief@v1", schema: MigrateBrief },
    { schemaName: "migrate.coexistence@v1", schema: MigrateCoexistence },
    { schemaName: "migrate.batch@v1", schema: MigrateBatch },
    { schemaName: "migrate.verification@v1", schema: MigrateVerification },
    { schemaName: "migrate.result@v1", schema: MigrateResult }
  ],
  writers: {
    compose: [migrateBriefComposeBuilder, migrateCoexistenceComposeBuilder],
    close: [migrateCloseBuilder],
    verification: [migrateVerificationWriter],
    checkpoint: []
  }
};

// dist/flows/review/relay-hints.js
var reviewRelayShapeHint = {
  kind: "structural",
  id: "review.relay-result@structural",
  match(step) {
    return step.role === "reviewer" && step.check.pass.includes("NO_ISSUES_FOUND") && step.check.pass.includes("ISSUES_FOUND");
  },
  instruction: [
    "Respond with a single raw JSON object whose top-level shape is exactly:",
    '{ "verdict": "<one-of-accepted-verdicts>", "findings": [{ "severity": "<critical|high|low>", "id": "<stable finding id>", "text": "<finding text>", "file_refs": ["<file:line reference>"] }] }',
    'Use an empty findings array when there are no issues: { "verdict": "NO_ISSUES_FOUND", "findings": [] }.',
    "Use an empty file_refs array when a finding has no file-specific reference.",
    "Do not include extra top-level keys. Do not wrap the JSON in Markdown code fences. Do not include any prose before or after the JSON object.",
    "The runtime parses your response with JSON.parse, rejects any verdict not drawn from the accepted-verdicts list, and the close step validates findings before writing reports/review-result.json."
  ].join(" ")
};

// dist/flows/review/reports.js
var ReviewFindingSeverity = external_exports.enum(["critical", "high", "low"]);
var ReviewResultVerdict = external_exports.enum(["CLEAN", "ISSUES_FOUND"]);
var ReviewRelayVerdict = external_exports.enum(["NO_ISSUES_FOUND", "ISSUES_FOUND"]);
var ReviewEvidenceWarningKind = external_exports.enum([
  "diff_truncated",
  "git_command_failed",
  "untracked_file_skipped",
  "untracked_file_content_omitted",
  "untracked_files_truncated",
  "evidence_unavailable",
  "scope_empty"
]);
var ReviewEvidenceWarning = external_exports.object({
  kind: ReviewEvidenceWarningKind,
  message: external_exports.string().min(1),
  path: external_exports.string().min(1).optional()
}).strict();
var ReviewEvidenceText = external_exports.object({
  text: external_exports.string(),
  truncated: external_exports.boolean()
}).strict();
var ReviewUntrackedContentPolicy = external_exports.enum(["metadata-only", "include-content"]);
var ReviewUntrackedFileEvidence = external_exports.object({
  path: external_exports.string().min(1),
  byte_length: external_exports.number().int().nonnegative(),
  content: ReviewEvidenceText.optional(),
  skipped_reason: external_exports.string().min(1).optional()
}).strict();
var ReviewEvidence = external_exports.discriminatedUnion("kind", [
  external_exports.object({
    kind: external_exports.literal("unavailable"),
    reason: external_exports.string().min(1)
  }).strict(),
  external_exports.object({
    kind: external_exports.literal("git-working-tree"),
    project_root: external_exports.string().min(1),
    status_short: external_exports.string(),
    staged_diff: ReviewEvidenceText,
    unstaged_diff: ReviewEvidenceText,
    diff_stat: external_exports.string(),
    untracked_file_count: external_exports.number().int().nonnegative(),
    untracked_files_truncated: external_exports.boolean(),
    untracked_content_policy: ReviewUntrackedContentPolicy,
    untracked_files: external_exports.array(ReviewUntrackedFileEvidence)
  }).strict()
]);
var ReviewEvidenceSummary = external_exports.discriminatedUnion("kind", [
  external_exports.object({
    kind: external_exports.literal("unavailable"),
    message: external_exports.string().min(1)
  }).strict(),
  external_exports.object({
    kind: external_exports.literal("git-working-tree"),
    untracked_content_policy: ReviewUntrackedContentPolicy,
    untracked_file_count: external_exports.number().int().nonnegative(),
    untracked_files_sampled: external_exports.number().int().nonnegative(),
    untracked_files_truncated: external_exports.boolean()
  }).strict()
]);
var ReviewIntake = external_exports.object({
  scope: external_exports.string().min(1),
  evidence: ReviewEvidence,
  evidence_warnings: external_exports.array(ReviewEvidenceWarning).default([])
}).strict();
var ReviewFinding = external_exports.object({
  severity: ReviewFindingSeverity,
  id: external_exports.string().min(1),
  text: external_exports.string().min(1),
  file_refs: external_exports.array(external_exports.string().min(1))
}).strict();
function computeReviewVerdict(findings) {
  return findings.some((finding) => finding.severity === "critical" || finding.severity === "high") ? "ISSUES_FOUND" : "CLEAN";
}
var ReviewResult = external_exports.object({
  scope: external_exports.string().min(1),
  findings: external_exports.array(ReviewFinding),
  verdict: ReviewResultVerdict,
  evidence_summary: ReviewEvidenceSummary.optional(),
  evidence_warnings: external_exports.array(ReviewEvidenceWarning).default([])
}).strict().superRefine((report, ctx) => {
  const expected = computeReviewVerdict(report.findings);
  if (report.verdict !== expected) {
    ctx.addIssue({
      code: external_exports.ZodIssueCode.custom,
      path: ["verdict"],
      message: `verdict must be ${expected} for the report findings (CLEAN iff critical_count == 0 and high_count == 0)`
    });
  }
});
var ReviewRelayResult = external_exports.object({
  verdict: ReviewRelayVerdict,
  findings: external_exports.array(ReviewFinding)
}).strict().superRefine((report, ctx) => {
  const expected = report.findings.length === 0 ? "NO_ISSUES_FOUND" : "ISSUES_FOUND";
  if (report.verdict !== expected) {
    ctx.addIssue({
      code: external_exports.ZodIssueCode.custom,
      path: ["verdict"],
      message: `review relay verdict must be ${expected} for findings.length=${report.findings.length}`
    });
  }
});

// dist/flows/review/writers/intake.js
import { spawnSync } from "node:child_process";
import { closeSync, lstatSync as lstatSync2, openSync, readSync } from "node:fs";
import { isAbsolute as isAbsolute2, relative as relative2, resolve as resolve2 } from "node:path";
var MAX_DIFF_CHARS = 12e4;
var MAX_UNTRACKED_FILES = 20;
var MAX_UNTRACKED_FILE_CHARS = 2e4;
var MAX_GIT_BUFFER_BYTES = 10 * 1024 * 1024;
var MAX_DIFF_BUFFER_BYTES = Math.max(MAX_DIFF_CHARS * 4, 1024 * 1024);
var MAX_UNTRACKED_FILE_BYTES = MAX_UNTRACKED_FILE_CHARS + 1;
function truncateText(text, maxChars) {
  if (text.length <= maxChars)
    return { text, truncated: false };
  return {
    text: `${text.slice(0, maxChars)}
[truncated ${text.length - maxChars} characters]`,
    truncated: true
  };
}
function errorMessage(err) {
  return err instanceof Error ? err.message : String(err);
}
function outputToString(output) {
  if (output === null || output === void 0)
    return "";
  if (typeof output === "string")
    return output;
  return Buffer.from(output).toString("utf8");
}
function runGit(projectRoot, args, options = {}) {
  const result = spawnSync("git", [...args], {
    cwd: projectRoot,
    encoding: "utf8",
    maxBuffer: options.maxBufferBytes ?? MAX_GIT_BUFFER_BYTES,
    stdio: ["ignore", "pipe", "pipe"]
  });
  const stdout = outputToString(result.stdout);
  const stderr = outputToString(result.stderr).trim();
  if (result.error !== void 0) {
    if (options.allowPartialStdout === true && stdout.length > 0) {
      return { ok: true, stdout, truncated_by_buffer: true };
    }
    return { ok: false, reason: `git ${args.join(" ")} failed: ${result.error.message}` };
  }
  if (result.status !== 0) {
    const reason = stderr.length > 0 ? stderr : `exited with status ${result.status ?? "unknown"}`;
    return { ok: false, reason: `git ${args.join(" ")} failed: ${reason}` };
  }
  return { ok: true, stdout, truncated_by_buffer: false };
}
function runGitDiff(projectRoot, args) {
  const result = runGit(projectRoot, args, {
    maxBufferBytes: MAX_DIFF_BUFFER_BYTES,
    allowPartialStdout: true
  });
  if (!result.ok)
    return truncateText(result.reason, MAX_DIFF_CHARS);
  if (!result.truncated_by_buffer)
    return truncateText(result.stdout, MAX_DIFF_CHARS);
  const truncated = truncateText(result.stdout, MAX_DIFF_CHARS);
  return {
    text: `${truncated.text}
[truncated because git output exceeded ${MAX_DIFF_BUFFER_BYTES} bytes before completion]`,
    truncated: true
  };
}
function insideProject(projectRoot, path) {
  const rel = relative2(projectRoot, path);
  return rel === "" || !rel.startsWith("..") && !isAbsolute2(rel);
}
function readUntrackedFile(projectRoot, path, contentPolicy) {
  const abs = resolve2(projectRoot, path);
  if (!insideProject(projectRoot, abs)) {
    return { path, byte_length: 0, skipped_reason: "path resolves outside project root" };
  }
  let stat2;
  try {
    stat2 = lstatSync2(abs);
  } catch (err) {
    return { path, byte_length: 0, skipped_reason: `failed to inspect file: ${errorMessage(err)}` };
  }
  if (stat2.isSymbolicLink()) {
    return { path, byte_length: stat2.size, skipped_reason: "symbolic link skipped" };
  }
  if (!stat2.isFile()) {
    return { path, byte_length: stat2.size, skipped_reason: "not a regular file" };
  }
  if (contentPolicy === "metadata-only") {
    return { path, byte_length: stat2.size };
  }
  let fd;
  try {
    const byteLimit = Math.min(stat2.size, MAX_UNTRACKED_FILE_BYTES);
    fd = openSync(abs, "r");
    const bytes = Buffer.alloc(byteLimit);
    const bytesRead = readSync(fd, bytes, 0, byteLimit, 0);
    const sample = bytes.subarray(0, bytesRead);
    if (sample.includes(0)) {
      return { path, byte_length: stat2.size, skipped_reason: "binary file skipped" };
    }
    const content = truncateText(sample.toString("utf8"), MAX_UNTRACKED_FILE_CHARS);
    return {
      path,
      byte_length: stat2.size,
      content: stat2.size > bytesRead && !content.truncated ? { ...content, truncated: true } : content
    };
  } catch (err) {
    return {
      path,
      byte_length: stat2.size,
      skipped_reason: `failed to read file: ${errorMessage(err)}`
    };
  } finally {
    if (fd !== void 0) {
      try {
        closeSync(fd);
      } catch {
      }
    }
  }
}
function collectUntrackedFiles(projectRoot, contentPolicy) {
  const listed = runGit(projectRoot, ["ls-files", "--others", "--exclude-standard", "-z"]);
  if (!listed.ok)
    return { count: 0, truncated: false, files: [] };
  const paths = listed.stdout.split("\0").filter((path) => path.length > 0);
  return {
    count: paths.length,
    truncated: paths.length > MAX_UNTRACKED_FILES,
    files: paths.slice(0, MAX_UNTRACKED_FILES).map((path) => readUntrackedFile(projectRoot, path, contentPolicy))
  };
}
function collectReviewEvidence(projectRoot, options = {}) {
  if (projectRoot === void 0) {
    return {
      kind: "unavailable",
      reason: "CompiledFlowInvocation.projectRoot was not provided"
    };
  }
  const status = runGit(projectRoot, ["status", "--short"]);
  if (!status.ok)
    return { kind: "unavailable", reason: status.reason };
  const staged = runGitDiff(projectRoot, ["diff", "--cached", "--no-ext-diff", "--"]);
  const unstaged = runGitDiff(projectRoot, ["diff", "--no-ext-diff", "--"]);
  const diffStat = runGit(projectRoot, ["diff", "--stat", "--cached", "--no-ext-diff"]);
  const untrackedContentPolicy = options.includeUntrackedFileContent === true ? "include-content" : "metadata-only";
  const untracked = collectUntrackedFiles(projectRoot, untrackedContentPolicy);
  return {
    kind: "git-working-tree",
    project_root: projectRoot,
    status_short: status.stdout,
    staged_diff: staged,
    unstaged_diff: unstaged,
    diff_stat: diffStat.ok ? diffStat.stdout : diffStat.reason,
    untracked_file_count: untracked.count,
    untracked_files_truncated: untracked.truncated,
    untracked_content_policy: untrackedContentPolicy,
    untracked_files: untracked.files
  };
}
function gitCommandFailed(text) {
  return /^git\s+.+\s+failed:/.test(text);
}
function evidenceWarnings(evidence) {
  if (evidence.kind === "unavailable") {
    return [
      {
        kind: "evidence_unavailable",
        message: evidence.reason
      }
    ];
  }
  const warnings = [];
  if (evidence.staged_diff.text.length === 0 && evidence.unstaged_diff.text.length === 0 && !gitCommandFailed(evidence.staged_diff.text) && !gitCommandFailed(evidence.unstaged_diff.text)) {
    warnings.push({
      kind: "scope_empty",
      message: "review scoped to uncommitted changes only; HEAD~1 differences not examined. No staged or unstaged diff was present, so committed changes were not part of this review."
    });
  }
  if (evidence.staged_diff.truncated) {
    warnings.push({
      kind: "diff_truncated",
      message: "staged diff was truncated before relay"
    });
  }
  if (evidence.unstaged_diff.truncated) {
    warnings.push({
      kind: "diff_truncated",
      message: "unstaged diff was truncated before relay"
    });
  }
  if (gitCommandFailed(evidence.staged_diff.text)) {
    warnings.push({
      kind: "git_command_failed",
      message: evidence.staged_diff.text
    });
  }
  if (gitCommandFailed(evidence.unstaged_diff.text)) {
    warnings.push({
      kind: "git_command_failed",
      message: evidence.unstaged_diff.text
    });
  }
  if (gitCommandFailed(evidence.diff_stat)) {
    warnings.push({
      kind: "git_command_failed",
      message: evidence.diff_stat
    });
  }
  if (evidence.untracked_files_truncated) {
    warnings.push({
      kind: "untracked_files_truncated",
      message: `untracked file evidence was limited to ${MAX_UNTRACKED_FILES} files`
    });
  }
  if (evidence.untracked_content_policy === "metadata-only" && evidence.untracked_file_count > 0) {
    warnings.push({
      kind: "untracked_file_content_omitted",
      message: "untracked file contents were not included; pass --include-untracked-content only when those files are safe to relay"
    });
  }
  for (const file of evidence.untracked_files) {
    if (file.skipped_reason !== void 0) {
      warnings.push({
        kind: "untracked_file_skipped",
        path: file.path,
        message: file.skipped_reason
      });
    }
  }
  return warnings;
}
var reviewIntakeComposeBuilder = {
  resultSchemaName: "review.intake@v1",
  build(context) {
    const evidence = collectReviewEvidence(context.projectRoot, context.evidencePolicy?.includeUntrackedFileContent === true ? { includeUntrackedFileContent: true } : {});
    return ReviewIntake.parse({
      scope: context.goal,
      evidence,
      evidence_warnings: evidenceWarnings(evidence)
    });
  }
};

// dist/flows/review/writers/result.js
import { readFileSync as readFileSync7 } from "node:fs";
function reviewerRelayResultPath(flow, closeStep) {
  const closeStepId = closeStep.id;
  const reviewerRelayes = flow.steps.filter((candidate) => candidate.kind === "relay" && candidate.role === "reviewer" && candidate.routes.pass === closeStepId);
  if (reviewerRelayes.length !== 1) {
    throw new Error(`review.result@v1 requires exactly one reviewer relay routing to '${closeStepId}', found ${reviewerRelayes.length}`);
  }
  const resultPath2 = reviewerRelayes[0]?.writes.result;
  if (resultPath2 === void 0 || !closeStep.reads.includes(resultPath2)) {
    throw new Error(`review.result@v1 requires close step '${closeStepId}' to read the reviewer relay result path '${resultPath2 ?? "<missing>"}'`);
  }
  return resultPath2;
}
function reviewIntakePath(flow, closeStep) {
  const closeStepId = closeStep.id;
  const intakeStep = flow.steps.find((candidate) => candidate.kind === "compose" && candidate.writes.report.schema === "review.intake@v1" && closeStep.reads.includes(candidate.writes.report.path));
  const path = intakeStep?.writes.report.path;
  if (path === void 0) {
    throw new Error(`review.result@v1 requires close step '${closeStepId}' to read the review intake report`);
  }
  return path;
}
function evidenceSummary(evidence) {
  if (evidence.kind === "unavailable") {
    return { kind: "unavailable", message: evidence.reason };
  }
  return {
    kind: "git-working-tree",
    untracked_content_policy: evidence.untracked_content_policy,
    untracked_file_count: evidence.untracked_file_count,
    untracked_files_sampled: evidence.untracked_files.length,
    untracked_files_truncated: evidence.untracked_files_truncated
  };
}
var reviewResultComposeBuilder = {
  resultSchemaName: "review.result@v1",
  // No declarative reads — the read is a relay result body, not a
  // typed report at a schema-mapped path. The build function does
  // its own resolution.
  build(context) {
    const path = reviewerRelayResultPath(context.flow, context.step);
    const intake = ReviewIntake.parse(JSON.parse(readFileSync7(resolveRunRelative(context.runFolder, reviewIntakePath(context.flow, context.step)), "utf8")));
    const relayResult = ReviewRelayResult.parse(JSON.parse(readFileSync7(resolveRunRelative(context.runFolder, path), "utf8")));
    return ReviewResult.parse({
      scope: intake.scope,
      findings: relayResult.findings,
      verdict: computeReviewVerdict(relayResult.findings),
      evidence_summary: evidenceSummary(intake.evidence),
      evidence_warnings: intake.evidence_warnings
    });
  }
};

// dist/flows/review/index.js
var REVIEW_SIGNALS = [
  { label: "code review", pattern: /\bcode\s+review\b/i },
  {
    label: "change review request",
    pattern: /\breview\s+(?:this\s+|the\s+|my\s+|a\s+)?(?:[\w-]+\s+){0,8}(?:changes?|diff|patch|commit|pr|pull\s+request|code|report|file)\b/i
  },
  { label: "audit request", pattern: /\baudit\b/i },
  { label: "critique request", pattern: /\bcritique\b/i },
  {
    label: "change inspection request",
    pattern: /\binspect\s+(?:this\s+|the\s+|my\s+|a\s+)?(?:change|diff|patch|commit|pr|pull\s+request|code|report|file)\b/i
  },
  {
    label: "change-check request",
    pattern: /\bcheck\s+(?:this\s+)?(?:change|diff|patch|commit|pr|pull\s+request)\b/i
  },
  {
    label: "issue-finding request",
    pattern: /\b(?:find|surface|identify|spot|detect|look\s+for)\s+(?:an?\s+|any\s+)?(?:(?:issue|issues)(?!\s*(?:#|\d))|bug|bugs|defect|defects|problem|problems|regression|regressions|risk|risks)\b/i
  },
  {
    label: "risk-hunt request",
    pattern: /\blook\s+for\s+(?:bugs|issues|regressions|risks)\b/i
  }
];
var reviewCompiledFlowPackage = {
  id: "review",
  visibility: "public",
  paths: {
    schematic: "src/flows/review/schematic.json",
    command: "src/flows/review/command.md",
    contract: "src/flows/review/contract.md"
  },
  routing: {
    order: 0,
    signals: REVIEW_SIGNALS,
    reasonForMatch(signal) {
      return `matched ${signal.label}; routed to audit-only review flow`;
    }
  },
  relayReports: [],
  reportSchemas: [
    { schemaName: "review.intake@v1", schema: ReviewIntake },
    { schemaName: "review.result@v1", schema: ReviewResult }
  ],
  writers: {
    compose: [reviewIntakeComposeBuilder, reviewResultComposeBuilder],
    close: [],
    verification: [],
    checkpoint: []
  },
  structuralHints: [reviewRelayShapeHint]
};

// dist/flows/runtime-proof/reports.js
var RuntimeProofCompose = external_exports.object({
  summary: external_exports.string().min(1)
}).strict();

// dist/flows/runtime-proof/writers/compose.js
var runtimeProofComposeBuilder = {
  resultSchemaName: "plan.strategy@v1",
  build(context) {
    return RuntimeProofCompose.parse({
      summary: `Runtime proof composed for: ${context.goal}`
    });
  }
};

// dist/flows/runtime-proof/index.js
var runtimeProofCompiledFlowPackage = {
  id: "runtime-proof",
  visibility: "internal",
  paths: {
    schematic: "src/flows/runtime-proof/schematic.json"
  },
  relayReports: [],
  reportSchemas: [{ schemaName: "runtime-proof.compose@v1", schema: RuntimeProofCompose }],
  writers: {
    compose: [runtimeProofComposeBuilder],
    close: [],
    verification: [],
    checkpoint: []
  }
};

// dist/flows/sweep/cross-report-validators.js
import { existsSync as existsSync2, readFileSync as readFileSync8 } from "node:fs";
import { resolve as resolve3 } from "node:path";

// dist/flows/sweep/reports.js
var SWEEP_RESULT_SCHEMA_BY_ARTIFACT_ID = {
  "sweep.brief": "sweep.brief@v1",
  "sweep.analysis": "sweep.analysis@v1",
  "sweep.queue": "sweep.queue@v1",
  "sweep.batch": "sweep.batch@v1",
  "sweep.verification": "sweep.verification@v1",
  "sweep.review": "sweep.review@v1"
};
var NonEmptyStringArray4 = external_exports.array(external_exports.string().min(1)).min(1);
var SweepType = external_exports.enum(["cleanup", "quality", "coverage", "docs-sync"]);
var SweepConfidence = external_exports.enum(["low", "medium", "high"]);
var SweepRisk = external_exports.enum(["low", "medium", "high"]);
var SweepBrief = external_exports.object({
  objective: external_exports.string().min(1),
  sweep_type: SweepType,
  scope: external_exports.string().min(1),
  success_criteria: NonEmptyStringArray4,
  scope_exclusions: external_exports.array(external_exports.string().min(1)),
  out_of_scope: external_exports.array(external_exports.string().min(1)),
  high_risk_boundaries: external_exports.array(external_exports.string().min(1)),
  verification_command_candidates: external_exports.array(VerificationCommand).min(1)
}).strict();
var SweepCandidate = external_exports.object({
  id: external_exports.string().min(1),
  category: external_exports.string().min(1),
  path: external_exports.string().min(1),
  description: external_exports.string().min(1),
  confidence: SweepConfidence,
  risk: SweepRisk
}).strict();
var SweepAnalysis = external_exports.object({
  verdict: external_exports.literal("accept"),
  summary: external_exports.string().min(1),
  candidates: external_exports.array(SweepCandidate).min(1)
}).strict().superRefine((analysis, ctx) => {
  const seen = /* @__PURE__ */ new Set();
  for (const [index, candidate] of analysis.candidates.entries()) {
    if (seen.has(candidate.id)) {
      ctx.addIssue({
        code: external_exports.ZodIssueCode.custom,
        path: ["candidates", index, "id"],
        message: `duplicate candidate id: ${candidate.id}`
      });
    }
    seen.add(candidate.id);
  }
});
var SweepAction = external_exports.enum(["act", "prove-then-act", "prove", "defer"]);
var SweepQueueItem = external_exports.object({
  candidate_id: external_exports.string().min(1),
  action: SweepAction,
  rationale: external_exports.string().min(1)
}).strict();
var SweepQueue = external_exports.object({
  classified: external_exports.array(SweepQueueItem).min(1),
  to_execute: external_exports.array(external_exports.string().min(1)),
  deferred: external_exports.array(external_exports.string().min(1))
}).strict().superRefine((queue, ctx) => {
  const classifiedIds = new Set(queue.classified.map((item) => item.candidate_id));
  const seenClassified = /* @__PURE__ */ new Set();
  for (const [index, item] of queue.classified.entries()) {
    if (seenClassified.has(item.candidate_id)) {
      ctx.addIssue({
        code: external_exports.ZodIssueCode.custom,
        path: ["classified", index, "candidate_id"],
        message: `duplicate classified candidate_id: ${item.candidate_id}`
      });
    }
    seenClassified.add(item.candidate_id);
  }
  for (const [index, id] of queue.to_execute.entries()) {
    if (!classifiedIds.has(id)) {
      ctx.addIssue({
        code: external_exports.ZodIssueCode.custom,
        path: ["to_execute", index],
        message: `to_execute references unclassified candidate_id: ${id}`
      });
    }
  }
  for (const [index, id] of queue.deferred.entries()) {
    if (!classifiedIds.has(id)) {
      ctx.addIssue({
        code: external_exports.ZodIssueCode.custom,
        path: ["deferred", index],
        message: `deferred references unclassified candidate_id: ${id}`
      });
    }
  }
  const executeSet = new Set(queue.to_execute);
  const deferredSet = new Set(queue.deferred);
  for (const id of executeSet) {
    if (deferredSet.has(id)) {
      ctx.addIssue({
        code: external_exports.ZodIssueCode.custom,
        path: ["to_execute"],
        message: `candidate_id appears in both to_execute and deferred: ${id}`
      });
    }
  }
});
var SweepBatchItemStatus = external_exports.enum(["acted", "reverted", "partial"]);
var SweepBatchItemResult = external_exports.object({
  candidate_id: external_exports.string().min(1),
  status: SweepBatchItemStatus,
  evidence: external_exports.string().min(1)
}).strict();
var SweepBatchVerdict = external_exports.enum(["accept", "partial", "reverted"]);
var SweepBatch = external_exports.object({
  verdict: SweepBatchVerdict,
  summary: external_exports.string().min(1),
  changed_files: external_exports.array(external_exports.string().min(1)),
  items: external_exports.array(SweepBatchItemResult).min(1)
}).strict().superRefine((batch, ctx) => {
  const seen = /* @__PURE__ */ new Set();
  for (const [index, item] of batch.items.entries()) {
    if (seen.has(item.candidate_id)) {
      ctx.addIssue({
        code: external_exports.ZodIssueCode.custom,
        path: ["items", index, "candidate_id"],
        message: `duplicate item candidate_id: ${item.candidate_id}`
      });
    }
    seen.add(item.candidate_id);
  }
  const allReverted = batch.items.every((item) => item.status === "reverted");
  const anyActed = batch.items.some((item) => item.status === "acted");
  const anyReverted = batch.items.some((item) => item.status === "reverted");
  const expectedVerdict = allReverted && batch.items.length > 0 ? "reverted" : anyReverted || !anyActed ? "partial" : "accept";
  if (batch.verdict !== expectedVerdict) {
    ctx.addIssue({
      code: external_exports.ZodIssueCode.custom,
      path: ["verdict"],
      message: `verdict must be '${expectedVerdict}' for the observed item statuses`
    });
  }
});
var SweepVerification = VerificationResult;
var SweepReviewVerdict = external_exports.enum([
  "clean",
  "minor-injections",
  "critical-injections",
  "reject"
]);
var SweepReviewFinding = external_exports.object({
  severity: external_exports.enum(["critical", "high", "medium", "low"]),
  text: external_exports.string().min(1),
  file_refs: external_exports.array(external_exports.string().min(1))
}).strict();
var SweepReview = external_exports.object({
  verdict: SweepReviewVerdict,
  summary: external_exports.string().min(1),
  findings: external_exports.array(SweepReviewFinding)
}).strict().superRefine((review, ctx) => {
  if (review.verdict !== "clean" && review.findings.length === 0) {
    ctx.addIssue({
      code: external_exports.ZodIssueCode.custom,
      path: ["findings"],
      message: `findings must be non-empty when verdict is '${review.verdict}'`
    });
  }
});
var SweepResultOutcome = external_exports.enum(["complete", "partial", "reverted", "failed"]);
var SweepResultReportId = external_exports.enum([
  "sweep.brief",
  "sweep.analysis",
  "sweep.queue",
  "sweep.batch",
  "sweep.verification",
  "sweep.review"
]);
var SweepResultReportPointer = external_exports.object({
  report_id: SweepResultReportId,
  path: external_exports.string().min(1),
  schema: external_exports.string().min(1)
}).strict().superRefine((pointer, ctx) => {
  const expectedSchema = SWEEP_RESULT_SCHEMA_BY_ARTIFACT_ID[pointer.report_id];
  if (pointer.schema !== expectedSchema) {
    ctx.addIssue({
      code: external_exports.ZodIssueCode.custom,
      path: ["schema"],
      message: `schema must be '${expectedSchema}' for report_id '${pointer.report_id}'`
    });
  }
});
var SweepResult = external_exports.object({
  summary: external_exports.string().min(1),
  outcome: SweepResultOutcome,
  verification_status: external_exports.enum(["passed", "failed"]),
  review_verdict: SweepReviewVerdict,
  deferred_count: external_exports.number().int().nonnegative(),
  evidence_links: external_exports.array(SweepResultReportPointer).length(6)
}).strict().superRefine((result, ctx) => {
  const seen = /* @__PURE__ */ new Set();
  for (const [index, pointer] of result.evidence_links.entries()) {
    if (seen.has(pointer.report_id)) {
      ctx.addIssue({
        code: external_exports.ZodIssueCode.custom,
        path: ["evidence_links", index, "report_id"],
        message: `duplicate report_id '${pointer.report_id}'`
      });
    }
    seen.add(pointer.report_id);
  }
  for (const reportId of SweepResultReportId.options) {
    if (!seen.has(reportId)) {
      ctx.addIssue({
        code: external_exports.ZodIssueCode.custom,
        path: ["evidence_links"],
        message: `missing report_id '${reportId}'`
      });
    }
  }
});

// dist/flows/sweep/cross-report-validators.js
function validateSweepBatchAgainstQueue(flow, runFolder, resultBody) {
  if (!flowHasReportSchemaInCompiledFlow(flow, "sweep.queue@v1")) {
    return { kind: "ok" };
  }
  const queueRel = reportPathForSchemaInCompiledFlow(flow, "sweep.queue@v1");
  const queueAbs = resolve3(runFolder, queueRel);
  if (!existsSync2(queueAbs)) {
    return {
      kind: "fail",
      reason: `sweep.batch validation requires sweep.queue at '${queueRel}' but file is missing`
    };
  }
  let queueRaw;
  try {
    queueRaw = readFileSync8(queueAbs, "utf8");
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { kind: "fail", reason: `cannot read sweep.queue at '${queueRel}': ${msg}` };
  }
  let queueJson;
  try {
    queueJson = JSON.parse(queueRaw);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { kind: "fail", reason: `sweep.queue at '${queueRel}' is not valid JSON: ${msg}` };
  }
  const queueParse = SweepQueue.safeParse(queueJson);
  if (!queueParse.success) {
    const issues = queueParse.error.issues.map((issue) => {
      const path = issue.path.length > 0 ? issue.path.join(".") : "<root>";
      return `${path}: ${issue.message}`;
    }).join("; ");
    return {
      kind: "fail",
      reason: `sweep.queue at '${queueRel}' failed schema validation (${issues})`
    };
  }
  const queue = queueParse.data;
  let batchJson;
  try {
    batchJson = JSON.parse(resultBody);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { kind: "fail", reason: `sweep.batch body is not valid JSON: ${msg}` };
  }
  const batchParse = SweepBatch.safeParse(batchJson);
  if (!batchParse.success) {
    return {
      kind: "fail",
      reason: "sweep.batch body did not validate against SweepBatch schema (cross-report validator)"
    };
  }
  const batch = batchParse.data;
  const allowed = new Set(queue.to_execute);
  const offPrescription = batch.items.map((item) => item.candidate_id).filter((id) => !allowed.has(id));
  if (offPrescription.length > 0) {
    return {
      kind: "fail",
      reason: `sweep.batch.items contains candidate_id(s) not in queue.to_execute: [${offPrescription.join(", ")}]; queue.to_execute=[${queue.to_execute.join(", ")}]`
    };
  }
  return { kind: "ok" };
}

// dist/flows/sweep/relay-hints.js
var sweepAnalysisShapeHint = {
  kind: "schema",
  schema: "sweep.analysis@v1",
  instruction: [
    "Respond with a single raw JSON object whose top-level shape is exactly:",
    '{ "verdict": "accept", "summary": "<what was surveyed>", "candidates": [{ "id": "<stable candidate id>", "category": "<candidate category, e.g. dead-code, lint, coverage-gap>", "path": "<project-relative path>", "description": "<one-line description of the candidate>", "confidence": "<low|medium|high>", "risk": "<low|medium|high>" }] }',
    "Each candidate id must be unique within candidates. The candidates array must contain at least one entry; if the survey finds none, do not respond \u2014 instead investigate further reads first.",
    "Do not include extra top-level keys. Do not wrap the JSON in Markdown code fences. Do not include any prose before or after the JSON object.",
    "The runtime parses your response with JSON.parse, rejects any verdict not drawn from the accepted-verdicts list, and validates the full report body against sweep.analysis@v1 before writing reports/sweep/analysis.json."
  ].join(" ")
};
var sweepBatchShapeHint = {
  kind: "schema",
  schema: "sweep.batch@v1",
  instruction: [
    "Respond with a single raw JSON object whose top-level shape is exactly:",
    '{ "verdict": "<accept|partial|reverted>", "summary": "<what changed>", "changed_files": ["<project-relative path>"], "items": [{ "candidate_id": "<id from sweep.queue.to_execute>", "status": "<acted|reverted|partial>", "evidence": "<how the change was applied or reverted>" }] }',
    `The items array must include exactly one entry for every candidate_id in the queue's to_execute list, with no duplicates. The verdict is computed from item statuses: "reverted" iff every item is reverted (and items is non-empty); "partial" iff any item is reverted or no item is acted; otherwise "accept". Use an empty changed_files array only when no file changed.`,
    "Do not include extra top-level keys. Do not wrap the JSON in Markdown code fences. Do not include any prose before or after the JSON object.",
    "The runtime parses your response with JSON.parse, rejects any verdict not drawn from the accepted-verdicts list, and validates the full report body against sweep.batch@v1 before writing reports/sweep/batch.json."
  ].join(" ")
};
var sweepReviewShapeHint = {
  kind: "schema",
  schema: "sweep.review@v1",
  instruction: [
    "Respond with a single raw JSON object whose top-level shape is exactly:",
    '{ "verdict": "<clean|minor-injections|critical-injections|reject>", "summary": "<review summary>", "findings": [{ "severity": "<critical|high|medium|low>", "text": "<finding text>", "file_refs": ["<file:line reference>"] }] }',
    'Use an empty findings array only with verdict "clean". Any other verdict must include at least one finding. Use an empty file_refs array when a finding has no file-specific reference.',
    "Do not include extra top-level keys. Do not wrap the JSON in Markdown code fences. Do not include any prose before or after the JSON object.",
    "The runtime parses your response with JSON.parse, rejects any verdict not drawn from the accepted-verdicts list, and validates the full report body against sweep.review@v1 before writing reports/sweep/review.json."
  ].join(" ")
};

// dist/flows/sweep/writers/brief.js
var DEFAULT_SWEEP_VERIFICATION_COMMAND = {
  id: "sweep-proof",
  cwd: ".",
  argv: ["npm", "run", "check"],
  timeout_ms: 12e4,
  max_output_bytes: 2e5,
  env: {}
};
var sweepBriefComposeBuilder = {
  resultSchemaName: "sweep.brief@v1",
  build(context) {
    const goal = context.goal;
    return SweepBrief.parse({
      objective: goal,
      sweep_type: "cleanup",
      scope: goal,
      success_criteria: [`Demonstrate the sweep addresses: ${goal}`],
      scope_exclusions: [],
      out_of_scope: [],
      high_risk_boundaries: [],
      verification_command_candidates: [DEFAULT_SWEEP_VERIFICATION_COMMAND]
    });
  }
};

// dist/flows/sweep/writers/close.js
var POINTERS4 = [
  { report_id: "sweep.brief", schema: "sweep.brief@v1" },
  { report_id: "sweep.analysis", schema: "sweep.analysis@v1" },
  { report_id: "sweep.queue", schema: "sweep.queue@v1" },
  { report_id: "sweep.batch", schema: "sweep.batch@v1" },
  { report_id: "sweep.verification", schema: "sweep.verification@v1" },
  { report_id: "sweep.review", schema: "sweep.review@v1" }
];
var sweepCloseBuilder = {
  resultSchemaName: "sweep.result@v1",
  reads: [
    { name: "brief", schema: "sweep.brief@v1", required: true },
    { name: "analysis", schema: "sweep.analysis@v1", required: true },
    { name: "queue", schema: "sweep.queue@v1", required: true },
    { name: "batch", schema: "sweep.batch@v1", required: true },
    { name: "verification", schema: "sweep.verification@v1", required: true },
    { name: "review", schema: "sweep.review@v1", required: true }
  ],
  build(context) {
    const brief = SweepBrief.parse(context.inputs.brief);
    SweepAnalysis.parse(context.inputs.analysis);
    const queue = SweepQueue.parse(context.inputs.queue);
    const batch = SweepBatch.parse(context.inputs.batch);
    const verification = SweepVerification.parse(context.inputs.verification);
    const review = SweepReview.parse(context.inputs.review);
    const verificationOk = verification.overall_status === "passed";
    const reviewClean = review.verdict === "clean";
    const reviewMinor = review.verdict === "minor-injections";
    const outcome = batch.verdict === "reverted" ? "reverted" : !verificationOk || review.verdict === "critical-injections" || review.verdict === "reject" ? "failed" : batch.verdict === "partial" || reviewMinor ? "partial" : reviewClean ? "complete" : "failed";
    return SweepResult.parse({
      summary: `Sweep result for ${brief.objective}: ${batch.summary}`,
      outcome,
      verification_status: verification.overall_status,
      review_verdict: review.verdict,
      deferred_count: queue.deferred.length,
      evidence_links: POINTERS4.map((p) => ({
        ...p,
        path: reportPathForSchemaInCompiledFlow(context.flow, p.schema)
      }))
    });
  }
};

// dist/flows/sweep/writers/queue.js
var RISK_ORDER = { low: 0, medium: 1, high: 2 };
function triageAction(confidence, risk) {
  if (confidence === "high" && risk === "low")
    return "act";
  if (confidence === "high" && risk !== "low")
    return "prove-then-act";
  if (confidence === "low" && risk === "high")
    return "defer";
  return "prove";
}
var sweepQueueComposeBuilder = {
  resultSchemaName: "sweep.queue@v1",
  reads: [{ name: "analysis", schema: "sweep.analysis@v1", required: true }],
  build(context) {
    const analysis = SweepAnalysis.parse(context.inputs.analysis);
    const classified = analysis.candidates.map((candidate) => ({
      candidate_id: candidate.id,
      action: triageAction(candidate.confidence, candidate.risk),
      rationale: `${candidate.confidence}-confidence \xD7 ${candidate.risk}-risk: ${candidate.description}`
    }));
    const deferred = classified.filter((item) => item.action === "defer").map((item) => item.candidate_id);
    const executable = classified.filter((item) => item.action !== "defer");
    const candidateById = new Map(analysis.candidates.map((candidate) => [candidate.id, candidate]));
    const to_execute = executable.slice().sort((a, b) => {
      const candidateA = candidateById.get(a.candidate_id);
      const candidateB = candidateById.get(b.candidate_id);
      if (candidateA === void 0 || candidateB === void 0)
        return 0;
      return RISK_ORDER[candidateA.risk] - RISK_ORDER[candidateB.risk];
    }).map((item) => item.candidate_id);
    return SweepQueue.parse({
      classified,
      to_execute,
      deferred
    });
  }
};

// dist/flows/sweep/writers/verification.js
import { readFileSync as readFileSync9 } from "node:fs";
var sweepVerificationWriter = {
  resultSchemaName: "sweep.verification@v1",
  loadCommands(context) {
    const briefPath = reportPathForSchemaInCompiledFlow(context.flow, "sweep.brief@v1");
    if (!context.step.reads.includes(briefPath)) {
      throw new Error(`sweep.verification@v1 requires step '${context.step.id}' to read ${briefPath}`);
    }
    const brief = SweepBrief.parse(JSON.parse(readFileSync9(resolveRunRelative(context.runFolder, briefPath), "utf8")));
    return brief.verification_command_candidates;
  },
  buildResult(observations) {
    const overallStatus = observations.some((o) => o.status === "failed") ? "failed" : "passed";
    return SweepVerification.parse({
      overall_status: overallStatus,
      commands: observations.map((o) => ({
        command_id: o.command.id,
        argv: o.command.argv,
        cwd: o.command.cwd,
        exit_code: o.exit_code,
        status: o.status,
        duration_ms: o.duration_ms,
        stdout_summary: o.stdout_summary,
        stderr_summary: o.stderr_summary
      }))
    });
  }
};

// dist/flows/sweep/index.js
var SWEEP_SIGNALS = [
  { label: "cleanup prefix", pattern: /^\s*cleanup\s*:/i },
  { label: "overnight prefix", pattern: /^\s*overnight\s*:/i },
  {
    label: "sweep request",
    pattern: /^\s*(?:please\s+)?(?:sweep|cleanup|clean\s+up)\s+(?:a\s+|an\s+|the\s+|this\s+|that\s+|our\s+|my\s+)?(?:repo|repository|codebase|dead\s+code|lint|docs|documentation|coverage|quality)\b/i
  }
];
var sweepCompiledFlowPackage = {
  id: "sweep",
  visibility: "public",
  paths: {
    schematic: "src/flows/sweep/schematic.json"
  },
  routing: {
    order: 40,
    signals: SWEEP_SIGNALS,
    reasonForMatch(signal) {
      return `matched ${signal.label}; routed to Sweep flow`;
    }
  },
  relayReports: [
    {
      schemaName: "sweep.analysis@v1",
      schema: SweepAnalysis,
      relayHint: sweepAnalysisShapeHint.instruction
    },
    {
      schemaName: "sweep.batch@v1",
      schema: SweepBatch,
      relayHint: sweepBatchShapeHint.instruction,
      crossReportValidate: validateSweepBatchAgainstQueue
    },
    {
      schemaName: "sweep.review@v1",
      schema: SweepReview,
      relayHint: sweepReviewShapeHint.instruction
    }
  ],
  reportSchemas: [
    { schemaName: "sweep.brief@v1", schema: SweepBrief },
    { schemaName: "sweep.queue@v1", schema: SweepQueue },
    { schemaName: "sweep.verification@v1", schema: SweepVerification },
    { schemaName: "sweep.result@v1", schema: SweepResult }
  ],
  writers: {
    compose: [sweepBriefComposeBuilder, sweepQueueComposeBuilder],
    close: [sweepCloseBuilder],
    verification: [sweepVerificationWriter],
    checkpoint: []
  }
};

// dist/flows/catalog.js
var flowPackages = [
  reviewCompiledFlowPackage,
  migrateCompiledFlowPackage,
  fixCompiledFlowPackage,
  runtimeProofCompiledFlowPackage,
  buildCompiledFlowPackage,
  exploreCompiledFlowPackage,
  sweepCompiledFlowPackage
];
var PACKAGES_BY_ID = (() => {
  const map = /* @__PURE__ */ new Map();
  for (const pkg of flowPackages) {
    if (map.has(pkg.id)) {
      throw new Error(`duplicate flow package id '${pkg.id}'`);
    }
    map.set(pkg.id, pkg);
  }
  return map;
})();
function findCompiledFlowPackageById(id) {
  return PACKAGES_BY_ID.get(id);
}

// dist/flows/registries/checkpoint-writers/registry.js
var REGISTRY = buildCheckpointRegistry(flowPackages);
function findCheckpointBriefBuilder(resultSchemaName) {
  return REGISTRY.get(resultSchemaName);
}

// dist/schemas/host.js
var HostKind = external_exports.enum(["generic-shell", "claude-code", "codex"]);
var HostConfig = external_exports.object({
  kind: HostKind.default("generic-shell")
}).strict();

// dist/schemas/config.js
var ConnectorReference = external_exports.discriminatedUnion("kind", [
  external_exports.object({ kind: external_exports.literal("builtin"), name: EnabledConnector }).strict(),
  external_exports.object({ kind: external_exports.literal("named"), name: ConnectorName }).strict()
]);
var RelayConfigBody = external_exports.object({
  default: external_exports.union([EnabledConnector, external_exports.literal("auto"), ConnectorName]).default("auto"),
  roles: external_exports.record(RelayRole, ConnectorReference).default({}),
  circuits: external_exports.record(CompiledFlowId, ConnectorReference).default({}),
  connectors: external_exports.record(ConnectorName, CustomConnectorDescriptor).default({})
}).strict();
var issueAt2 = (ctx, path, message) => {
  ctx.addIssue({ code: external_exports.ZodIssueCode.custom, path, message });
};
var RelayConfig = RelayConfigBody.superRefine((cfg, ctx) => {
  const ownConnectorKeys = Object.keys(cfg.connectors);
  const registered = new Set(ownConnectorKeys);
  const reserved = new Set(RESERVED_ADAPTER_NAMES);
  for (const name of ownConnectorKeys) {
    if (reserved.has(name)) {
      issueAt2(ctx, ["connectors", name], `connector name '${name}' is reserved (built-in or 'auto') and cannot be used as a custom connector key`);
    }
    const descriptor = cfg.connectors[name];
    if (descriptor && descriptor.name !== name) {
      issueAt2(ctx, ["connectors", name, "name"], `connector registry key '${name}' does not match descriptor name '${descriptor.name}'`);
    }
  }
  const known = /* @__PURE__ */ new Set(["auto", ...EnabledConnector.options, ...ownConnectorKeys]);
  if (typeof cfg.default === "string" && !known.has(cfg.default)) {
    issueAt2(ctx, ["default"], `relay.default references unknown connector: ${cfg.default}`);
  }
  for (const [role, ref] of Object.entries(cfg.roles)) {
    if (ref && ref.kind === "named" && !registered.has(ref.name)) {
      issueAt2(ctx, ["roles", role], `role connector not registered: ${ref.name}`);
    }
    if (role === "implementer" && ref && ref.kind === "named") {
      const descriptor = cfg.connectors[ref.name];
      if (descriptor?.capabilities.filesystem === "read-only") {
        issueAt2(ctx, ["roles", role], `custom connector '${ref.name}' is read-only and cannot be used for implementer relay steps`);
      }
    }
  }
  for (const [circuit, ref] of Object.entries(cfg.circuits)) {
    if (ref && ref.kind === "named" && !registered.has(ref.name)) {
      issueAt2(ctx, ["circuits", circuit], `circuit connector not registered: ${ref.name}`);
    }
  }
});
var SkillBindings = external_exports.record(SkillSlotId, SkillId);
var SkillsConfig = external_exports.object({
  bindings: SkillBindings.default({})
}).strict();
var CircuitOverride = external_exports.object({
  selection: SelectionOverride.optional(),
  skill_bindings: SkillBindings.default({})
}).strict();
var Config = external_exports.object({
  schema_version: external_exports.literal(1),
  host: HostConfig.default({ kind: "generic-shell" }),
  relay: RelayConfig.default({
    default: "auto",
    roles: {},
    circuits: {},
    connectors: {}
  }),
  skills: SkillsConfig.default({}),
  circuits: external_exports.record(CompiledFlowId, CircuitOverride).default({}),
  defaults: external_exports.object({
    selection: SelectionOverride.optional()
  }).strict().default({})
}).strict();
var ConfigLayer = external_exports.enum(["default", "user-global", "project", "invocation"]);
var LayeredConfig = external_exports.object({
  layer: ConfigLayer,
  source_path: external_exports.string().optional(),
  config: Config
}).strict();

// dist/runtime/domain/route.js
var TERMINAL_TARGETS = [
  "@complete",
  "@stop",
  "@handoff",
  "@escalate"
];

// dist/runtime/run-files/paths.js
import { existsSync as existsSync3, lstatSync as lstatSync3, realpathSync as realpathSync2 } from "node:fs";
import { isAbsolute as isAbsolute3, relative as relative3, resolve as resolve4, sep } from "node:path";
function isInsideOrSame(root, target) {
  const fromRoot = relative3(root, target);
  return fromRoot === "" || !fromRoot.startsWith("..") && !isAbsolute3(fromRoot);
}
function validateRunFilePath(runRelativePath) {
  const issues = [];
  if (runRelativePath.trim().length === 0) {
    issues.push("must be non-empty");
  }
  if (isAbsolute3(runRelativePath)) {
    issues.push("must be relative");
  }
  if (runRelativePath.includes("\\")) {
    issues.push('must use POSIX "/" separators');
  }
  if (runRelativePath.includes(":")) {
    issues.push("must not contain drive-letter or colon forms");
  }
  if (runRelativePath.split("/").some((segment) => segment.length === 0 || segment === "." || segment === "..")) {
    issues.push("must not contain empty, current-directory, or parent-directory segments");
  }
  return issues;
}
function resolveRunFilePath(runDir, runRelativePath) {
  if (runRelativePath.trim().length === 0) {
    throw new Error("run file path must be non-empty");
  }
  if (isAbsolute3(runRelativePath)) {
    throw new Error(`run file path must be relative: ${runRelativePath}`);
  }
  const root = resolve4(runDir);
  const fullPath = resolve4(root, runRelativePath);
  if (fullPath !== root && !fullPath.startsWith(`${root}${sep}`)) {
    throw new Error(`run file path escapes run directory: ${runRelativePath}`);
  }
  if (fullPath === root) {
    throw new Error(`run file path must name a file: ${runRelativePath}`);
  }
  const validation = validateRunFilePath(runRelativePath);
  if (validation.length > 0) {
    throw new Error(`run file path ${validation[0]}: ${runRelativePath}`);
  }
  if (existsSync3(root)) {
    if (lstatSync3(root).isSymbolicLink()) {
      throw new Error(`run file path crosses symlink: ${runRelativePath}`);
    }
    const rootReal = realpathSync2.native(root);
    let cursor = root;
    for (const segment of runRelativePath.split("/")) {
      cursor = resolve4(cursor, segment);
      if (!existsSync3(cursor))
        break;
      if (lstatSync3(cursor).isSymbolicLink()) {
        throw new Error(`run file path crosses symlink: ${runRelativePath}`);
      }
      if (!isInsideOrSame(rootReal, realpathSync2.native(cursor))) {
        throw new Error(`run file path escapes run directory through symlink: ${runRelativePath}`);
      }
    }
  }
  return fullPath;
}

// dist/runtime/manifest/validate-executable-flow.js
function requiredRoutesForStep() {
  return ["pass"];
}
function isRouteTarget(value) {
  if (typeof value !== "object" || value === null)
    return false;
  const target = value;
  if (target.kind === "step")
    return typeof target.stepId === "string" && target.stepId.length > 0;
  if (target.kind === "terminal") {
    return typeof target.target === "string" && TERMINAL_TARGETS.includes(target.target);
  }
  return false;
}
function addRunFilePathIssues(issues, owner, ref) {
  for (const issue of validateRunFilePath(ref.path)) {
    issues.push(`${owner} path ${issue}: ${ref.path}`);
  }
}
function validateExecutableFlow(flow) {
  const issues = [];
  const stepIds = /* @__PURE__ */ new Set();
  const duplicateStepIds = /* @__PURE__ */ new Set();
  const stageIds = /* @__PURE__ */ new Set();
  const duplicateStageIds = /* @__PURE__ */ new Set();
  const stageStepCounts = /* @__PURE__ */ new Map();
  const entryModeNames = /* @__PURE__ */ new Set();
  const duplicateEntryModeNames = /* @__PURE__ */ new Set();
  if (flow.steps.length === 0)
    issues.push("flow must declare at least one step");
  if (flow.stages.length === 0)
    issues.push("flow must declare at least one stage");
  for (const step of flow.steps) {
    if (stepIds.has(step.id))
      duplicateStepIds.add(step.id);
    stepIds.add(step.id);
  }
  for (const stage of flow.stages) {
    if (stageIds.has(stage.id))
      duplicateStageIds.add(stage.id);
    stageIds.add(stage.id);
    if (stage.stepIds.length === 0)
      issues.push(`stage '${stage.id}' must declare at least one step`);
    const seenInStage = /* @__PURE__ */ new Set();
    for (const stepId of stage.stepIds) {
      if (seenInStage.has(stepId)) {
        issues.push(`stage '${stage.id}' lists step '${stepId}' more than once`);
      }
      seenInStage.add(stepId);
      stageStepCounts.set(stepId, (stageStepCounts.get(stepId) ?? 0) + 1);
    }
  }
  for (const stepId of duplicateStepIds)
    issues.push(`duplicate step id: ${stepId}`);
  for (const stageId of duplicateStageIds)
    issues.push(`duplicate stage id: ${stageId}`);
  if (!stepIds.has(flow.entry))
    issues.push(`entry step does not exist: ${flow.entry}`);
  if (flow.entryModes !== void 0) {
    if (flow.entryModes.length === 0) {
      issues.push("entryModes must not be empty when provided");
    }
    for (const mode of flow.entryModes) {
      if (entryModeNames.has(mode.name))
        duplicateEntryModeNames.add(mode.name);
      entryModeNames.add(mode.name);
      if (!stepIds.has(mode.startAt)) {
        issues.push(`entry mode '${mode.name}' startAt references unknown step '${mode.startAt}'`);
      }
    }
  }
  for (const modeName of duplicateEntryModeNames) {
    issues.push(`duplicate entry mode name: ${modeName}`);
  }
  for (const stage of flow.stages) {
    for (const stepId of stage.stepIds) {
      if (!stepIds.has(stepId))
        issues.push(`stage '${stage.id}' references unknown step '${stepId}'`);
    }
  }
  for (const step of flow.steps) {
    const stageListingCount = stageStepCounts.get(step.id) ?? 0;
    if (stageListingCount === 0) {
      issues.push(`step '${step.id}' is not listed in any stage`);
    }
    for (const [index, ref] of (step.reads ?? []).entries()) {
      addRunFilePathIssues(issues, `step '${step.id}' read[${index}]`, ref);
    }
    for (const [slot, ref] of Object.entries(step.writes ?? {})) {
      addRunFilePathIssues(issues, `step '${step.id}' write '${slot}'`, ref);
    }
    if (step.kind === "relay" && step.report !== void 0) {
      addRunFilePathIssues(issues, `relay step '${step.id}' report`, step.report);
    }
    if (step.kind === "fanout" && typeof step.join === "object" && step.join !== null) {
      const aggregate = step.join.aggregate;
      if (typeof aggregate === "object" && aggregate !== null && typeof aggregate.path === "string") {
        addRunFilePathIssues(issues, `fanout step '${step.id}' aggregate`, aggregate);
      }
    }
    if (step.kind === "checkpoint") {
      if (step.choices.length === 0) {
        issues.push(`checkpoint step '${step.id}' must declare at least one choice`);
      }
      const seenChoices = /* @__PURE__ */ new Set();
      for (const choice of step.choices) {
        if (seenChoices.has(choice)) {
          issues.push(`checkpoint step '${step.id}' has duplicate choice '${choice}'`);
        }
        seenChoices.add(choice);
      }
    }
    for (const requiredRoute of requiredRoutesForStep()) {
      if (step.routes[requiredRoute] === void 0) {
        issues.push(`step '${step.id}' is missing required route '${requiredRoute}'`);
      }
    }
    for (const [routeName, target] of Object.entries(step.routes)) {
      if (!isRouteTarget(target)) {
        issues.push(`step '${step.id}' route '${routeName}' has invalid target`);
        continue;
      }
      if (target.kind === "step" && !stepIds.has(target.stepId)) {
        issues.push(`step '${step.id}' route '${routeName}' targets unknown step '${target.stepId}'`);
      }
    }
  }
  return { ok: issues.length === 0, issues };
}
function assertExecutableFlow(flow) {
  const validation = validateExecutableFlow(flow);
  if (!validation.ok) {
    throw new Error(`invalid executable flow: ${validation.issues.join("; ")}`);
  }
}

// dist/runtime/manifest/from-compiled-flow.js
function isReportRef(value) {
  return typeof value === "object" && value !== null && typeof value.path === "string" && typeof value.schema === "string";
}
function toRunFileRef(value) {
  if (isReportRef(value))
    return { path: value.path, schema: value.schema };
  return { path: value };
}
function toWrites(writes) {
  const mapped = {};
  for (const [slot, value] of Object.entries(writes)) {
    if (value === void 0)
      continue;
    mapped[slot] = toRunFileRef(value);
  }
  return mapped;
}
function toRoutes(routes) {
  const terminalTargets = new Set(TERMINAL_TARGETS);
  const mapped = {};
  for (const [routeName, target] of Object.entries(routes)) {
    mapped[routeName] = terminalTargets.has(target) ? { kind: "terminal", target } : { kind: "step", stepId: target };
  }
  return mapped;
}
function toSelection(selection) {
  if (selection === void 0)
    return void 0;
  return {
    ...selection.model === void 0 ? {} : { model: selection.model },
    ...selection.effort === void 0 ? {} : { effort: selection.effort },
    ...selection.skills === void 0 ? {} : { skills: selection.skills },
    ...selection.depth === void 0 ? {} : { depth: selection.depth },
    ...selection.invocation_options === void 0 ? {} : { invocation_options: selection.invocation_options }
  };
}
function baseStep(step) {
  const selection = toSelection(step.selection);
  return {
    id: step.id,
    title: step.title,
    protocol: step.protocol,
    routes: toRoutes(step.routes),
    reads: step.reads.map((path) => ({ path })),
    writes: toWrites(step.writes),
    ...selection === void 0 ? {} : { selection },
    check: step.check,
    ...step.budgets === void 0 ? {} : { budgets: step.budgets }
  };
}
function convertStep(step) {
  const base = baseStep(step);
  if (step.kind === "compose") {
    return { ...base, kind: "compose", writer: step.protocol };
  }
  if (step.kind === "verification") {
    return { ...base, kind: "verification", check: step.check };
  }
  if (step.kind === "checkpoint") {
    return {
      ...base,
      kind: "checkpoint",
      choices: step.policy.choices.map((choice) => choice.id),
      policy: step.policy
    };
  }
  if (step.kind === "relay") {
    return {
      ...base,
      kind: "relay",
      role: step.role,
      ...step.writes.report === void 0 ? {} : { report: toRunFileRef(step.writes.report) }
    };
  }
  if (step.kind === "sub-run") {
    return {
      ...base,
      kind: "sub-run",
      flowRef: step.flow_ref.flow_id,
      entryMode: step.flow_ref.entry_mode,
      ...step.flow_ref.version === void 0 ? {} : { version: step.flow_ref.version },
      goal: step.goal,
      depth: step.depth
    };
  }
  return {
    ...base,
    kind: "fanout",
    branches: step.branches,
    join: {
      aggregate: toRunFileRef(step.writes.aggregate),
      on_child_failure: step.on_child_failure
    },
    concurrency: step.concurrency,
    onChildFailure: step.on_child_failure
  };
}
function fromCompiledFlow(flow) {
  const defaultEntryMode = flow.entry_modes[0];
  if (defaultEntryMode === void 0) {
    throw new Error(`compiled flow v1 '${flow.id}' has no entry modes`);
  }
  const defaultSelection = toSelection(flow.default_selection);
  const executable = {
    id: flow.id,
    version: flow.version,
    purpose: flow.purpose,
    entry: defaultEntryMode.start_at,
    entryModes: flow.entry_modes.map((mode) => ({
      name: mode.name,
      startAt: mode.start_at,
      depth: mode.depth,
      description: mode.description,
      ...mode.default_change_kind === void 0 ? {} : { defaultChangeKind: mode.default_change_kind }
    })),
    stages: flow.stages.map((stage) => {
      const selection = toSelection(stage.selection);
      return {
        id: stage.id,
        title: stage.title,
        ...stage.canonical === void 0 ? {} : { canonical: stage.canonical },
        stepIds: stage.steps,
        ...selection === void 0 ? {} : { selection }
      };
    }),
    steps: flow.steps.map((step) => convertStep(step)),
    ...defaultSelection === void 0 ? {} : { defaultSelection },
    stagePathPolicy: flow.stage_path_policy,
    metadata: {
      source: "compiled-flow-v1",
      schema_version: flow.schema_version
    }
  };
  assertExecutableFlow(executable);
  return executable;
}

// dist/runtime/trace/trace-store.js
import { appendFile, mkdir, readFile } from "node:fs/promises";
import { join } from "node:path";
var TraceStore = class {
  runDir;
  options;
  tracePath;
  entries = [];
  nextSequence = 0;
  closed = false;
  appendTail = Promise.resolve();
  constructor(runDir, options = {}) {
    this.runDir = runDir;
    this.options = options;
    this.tracePath = join(runDir, "trace.ndjson");
  }
  async load() {
    await this.appendTail;
    let raw = "";
    try {
      raw = await readFile(this.tracePath, "utf8");
    } catch (error) {
      if (error.code === "ENOENT") {
        this.entries = [];
        this.nextSequence = 0;
        this.closed = false;
        return this.entries;
      }
      throw error;
    }
    const rawEntries = raw.split("\n").filter((line) => line.trim().length > 0).map((line) => JSON.parse(line));
    const entries = [];
    for (const [index, entry] of rawEntries.entries()) {
      if (entry === null || typeof entry !== "object" || Array.isArray(entry)) {
        throw new Error(`trace entry ${index} is not an object`);
      }
      const candidate = TraceEntry.parse(entry);
      if (typeof candidate.sequence !== "number" || !Number.isInteger(candidate.sequence)) {
        throw new Error(`trace entry ${index} has no integer sequence`);
      }
      if (candidate.sequence !== index) {
        throw new Error(`trace sequence mismatch at entry ${index}: expected ${index}, found ${candidate.sequence}`);
      }
      entries.push(candidate);
    }
    const closedIndex = entries.findIndex((entry) => entry.kind === "run.closed");
    if (closedIndex !== -1 && closedIndex !== entries.length - 1) {
      throw new Error(`trace entry after run.closed at sequence ${closedIndex}`);
    }
    this.entries = entries;
    this.nextSequence = entries.length === 0 ? 0 : Math.max(...entries.map((entry) => entry.sequence)) + 1;
    this.closed = entries.some((entry) => entry.kind === "run.closed");
    return this.entries;
  }
  async append(input) {
    const appendOne = async () => {
      if (this.closed) {
        throw new Error("cannot append trace entry after run close");
      }
      const entry = TraceEntry.parse({
        ...input,
        schema_version: input.schema_version ?? 1,
        recorded_at: input.recorded_at ?? (this.options.now ?? (() => /* @__PURE__ */ new Date()))().toISOString(),
        sequence: this.nextSequence
      });
      await mkdir(this.runDir, { recursive: true });
      await appendFile(this.tracePath, `${JSON.stringify(entry)}
`, "utf8");
      this.nextSequence += 1;
      this.entries.push(entry);
      if (entry.kind === "run.closed") {
        this.closed = true;
      }
      try {
        await this.options.onAppend?.(entry);
      } catch {
      }
      return entry;
    };
    const result = this.appendTail.then(appendOne, appendOne);
    this.appendTail = result.then(() => void 0, () => void 0);
    return await result;
  }
  getAll() {
    return this.entries;
  }
};

// dist/schemas/compiled-flow-compat.js
function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
function normalizeCompiledFlowCompatibility(raw) {
  if (!isObject(raw) || !Array.isArray(raw.steps))
    return raw;
  let changed = false;
  const steps = raw.steps.map((step) => {
    if (!isObject(step))
      return step;
    if (step.kind !== "checkpoint")
      return step;
    if (!isObject(step.policy))
      return step;
    if (!Object.hasOwn(step.policy, "build_brief"))
      return step;
    if (Object.hasOwn(step.policy, "report_template"))
      return step;
    if (!isObject(step.writes))
      return step;
    if (!isObject(step.writes.report))
      return step;
    if (step.writes.report.schema !== "build.brief@v1")
      return step;
    const { build_brief: buildBrief, ...policyWithoutBuildBrief } = step.policy;
    const policy2 = {
      ...policyWithoutBuildBrief,
      report_template: buildBrief
    };
    changed = true;
    return { ...step, policy: policy2 };
  });
  if (!changed)
    return raw;
  return { ...raw, steps };
}

// dist/schemas/route-policy.js
var RUNTIME_SUCCESS_ROUTE = "pass";
var SCHEMATIC_SUCCESS_ROUTE_ALIASES = ["continue", "complete"];
var SUCCESS_ROUTE_ALIAS_SET = new Set(SCHEMATIC_SUCCESS_ROUTE_ALIASES);

// dist/schemas/stage.js
var CanonicalStage = external_exports.enum([
  "frame",
  "analyze",
  "plan",
  "act",
  "verify",
  "review",
  "close"
]);
var Stage = external_exports.object({
  id: StageId,
  title: external_exports.string().min(1),
  canonical: CanonicalStage.optional(),
  steps: external_exports.array(StepId).min(1),
  selection: SelectionOverride.optional()
}).strict();
var CANONICAL_STAGES = [
  "frame",
  "analyze",
  "plan",
  "act",
  "verify",
  "review",
  "close"
];
var SpinePolicy = external_exports.discriminatedUnion("mode", [
  external_exports.object({
    mode: external_exports.literal("strict")
  }).strict(),
  external_exports.object({
    mode: external_exports.literal("partial"),
    omits: external_exports.array(CanonicalStage).min(1),
    rationale: external_exports.string().min(20)
  }).strict()
]);

// dist/schemas/compiled-flow.js
var TERMINAL_ROUTE_TARGETS = /* @__PURE__ */ new Set(["@complete", "@stop", "@escalate", "@handoff"]);
var EntrySignals = external_exports.object({
  include: external_exports.array(external_exports.string()).default([]),
  exclude: external_exports.array(external_exports.string()).default([])
});
var EntryMode = external_exports.object({
  name: external_exports.string().regex(/^[a-z][a-z0-9-]*$/),
  start_at: StepId,
  depth: Depth,
  description: external_exports.string().min(1),
  default_change_kind: ChangeKind.optional()
});
var CompiledFlowBody = external_exports.object({
  schema_version: external_exports.literal("2"),
  id: CompiledFlowId,
  version: external_exports.string().min(1),
  purpose: external_exports.string().min(1),
  entry: external_exports.object({
    signals: EntrySignals,
    intent_prefixes: external_exports.array(external_exports.string()).default([])
  }).strict(),
  entry_modes: external_exports.array(EntryMode).min(1),
  stages: external_exports.array(Stage).min(1),
  stage_path_policy: SpinePolicy,
  steps: external_exports.array(Step).min(1),
  // Seed skill set is expressed through
  // `default_selection.skills = {mode: 'replace', skills: [...]}` so every
  // skill contribution flows through the typed SkillOverride operations,
  // closing the untyped-bypass path.
  default_selection: SelectionOverride.optional()
}).strict();
var issueAt3 = (ctx, path, message) => {
  ctx.addIssue({ code: external_exports.ZodIssueCode.custom, path, message });
};
var CompiledFlowStrict = CompiledFlowBody.superRefine((wf, ctx) => {
  const stepIds = /* @__PURE__ */ new Set();
  for (let i = 0; i < wf.steps.length; i++) {
    const step = wf.steps[i];
    if (step === void 0)
      continue;
    if (stepIds.has(step.id)) {
      issueAt3(ctx, ["steps", i, "id"], `duplicate step id: ${step.id}`);
    } else {
      stepIds.add(step.id);
    }
  }
  const stageIds = /* @__PURE__ */ new Set();
  for (let i = 0; i < wf.stages.length; i++) {
    const stage = wf.stages[i];
    if (stage === void 0)
      continue;
    if (stageIds.has(stage.id)) {
      issueAt3(ctx, ["stages", i, "id"], `duplicate stage id: ${stage.id}`);
    } else {
      stageIds.add(stage.id);
    }
    for (let j = 0; j < stage.steps.length; j++) {
      const sid = stage.steps[j];
      if (sid === void 0)
        continue;
      if (!stepIds.has(sid)) {
        issueAt3(ctx, ["stages", i, "steps", j], `stage references unknown step: ${sid}`);
      }
    }
  }
  const entryModeNames = /* @__PURE__ */ new Set();
  for (let i = 0; i < wf.entry_modes.length; i++) {
    const mode = wf.entry_modes[i];
    if (mode === void 0)
      continue;
    if (entryModeNames.has(mode.name)) {
      issueAt3(ctx, ["entry_modes", i, "name"], `duplicate entry mode: ${mode.name}`);
    } else {
      entryModeNames.add(mode.name);
    }
    if (!stepIds.has(mode.start_at)) {
      issueAt3(ctx, ["entry_modes", i, "start_at"], `entry mode start_at references unknown step: ${mode.start_at}`);
    }
  }
  for (let i = 0; i < wf.steps.length; i++) {
    const step = wf.steps[i];
    if (step === void 0)
      continue;
    for (const [label, target] of Object.entries(step.routes)) {
      if (TERMINAL_ROUTE_TARGETS.has(target))
        continue;
      if (!stepIds.has(target)) {
        issueAt3(ctx, ["steps", i, "routes", label], `route target is not @complete/@stop/@escalate/@handoff and not a known step: ${target}`);
      }
    }
    if (!Object.hasOwn(step.routes, RUNTIME_SUCCESS_ROUTE)) {
      issueAt3(ctx, ["steps", i, "routes"], `WF-I10: step '${step.id}' is missing a '${RUNTIME_SUCCESS_ROUTE}' route key \u2014 check.evaluated emits outcome \u2208 {pass, fail} uniformly, so routes must contain '${RUNTIME_SUCCESS_ROUTE}' to route on a successful check outcome`);
    }
  }
  const canonicalSeenAt = /* @__PURE__ */ new Map();
  for (let i = 0; i < wf.stages.length; i++) {
    const stage = wf.stages[i];
    if (stage === void 0)
      continue;
    if (stage.canonical === void 0)
      continue;
    const prior = canonicalSeenAt.get(stage.canonical);
    if (prior !== void 0) {
      issueAt3(ctx, ["stages", i, "canonical"], `duplicate canonical '${stage.canonical}' \u2014 also declared by stage at index ${prior}`);
    } else {
      canonicalSeenAt.set(stage.canonical, i);
    }
  }
  const declaredCanonicals = new Set(canonicalSeenAt.keys());
  const omits = /* @__PURE__ */ new Set();
  if (wf.stage_path_policy.mode === "partial") {
    const seenOmits = /* @__PURE__ */ new Set();
    for (let i = 0; i < wf.stage_path_policy.omits.length; i++) {
      const o = wf.stage_path_policy.omits[i];
      if (o === void 0)
        continue;
      if (seenOmits.has(o)) {
        issueAt3(ctx, ["stage_path_policy", "omits", i], `duplicate omit: '${o}' is listed more than once`);
      } else {
        seenOmits.add(o);
      }
      omits.add(o);
    }
  }
  for (const o of omits) {
    if (declaredCanonicals.has(o)) {
      issueAt3(ctx, ["stage_path_policy", "omits"], `canonical '${o}' is both declared as a Stage.canonical AND listed in stage_path_policy.omits \u2014 omits must be disjoint from declared canonicals`);
    }
  }
  for (const canonical of CANONICAL_STAGES) {
    if (omits.has(canonical))
      continue;
    if (!declaredCanonicals.has(canonical)) {
      issueAt3(ctx, ["stages"], `stage_path_policy requires canonical stage '${canonical}' \u2014 declare a Stage with canonical: '${canonical}', or move it into stage_path_policy.omits with a rationale`);
    }
  }
  const noDuplicateIds = stepIds.size === wf.steps.length;
  const adjacency = /* @__PURE__ */ new Map();
  let allRouteTargetsKnown = true;
  for (const step of wf.steps) {
    if (step === void 0)
      continue;
    const targets = Object.values(step.routes);
    adjacency.set(step.id, targets);
    for (const t of targets) {
      if (TERMINAL_ROUTE_TARGETS.has(t))
        continue;
      if (!stepIds.has(t)) {
        allRouteTargetsKnown = false;
      }
    }
  }
  let allEntryStartsKnown = true;
  for (const mode of wf.entry_modes) {
    if (mode === void 0)
      continue;
    if (!stepIds.has(mode.start_at)) {
      allEntryStartsKnown = false;
    }
  }
  if (noDuplicateIds && allRouteTargetsKnown && allEntryStartsKnown) {
    const terminalReaching = /* @__PURE__ */ new Set();
    for (const [sid, targets] of adjacency) {
      for (const t of targets) {
        if (TERMINAL_ROUTE_TARGETS.has(t)) {
          terminalReaching.add(sid);
          break;
        }
      }
    }
    let changed = true;
    while (changed) {
      changed = false;
      for (const [sid, targets] of adjacency) {
        if (terminalReaching.has(sid))
          continue;
        for (const t of targets) {
          if (terminalReaching.has(t)) {
            terminalReaching.add(sid);
            changed = true;
            break;
          }
        }
      }
    }
    for (let i = 0; i < wf.steps.length; i++) {
      const step = wf.steps[i];
      if (step === void 0)
        continue;
      if (!terminalReaching.has(step.id)) {
        issueAt3(ctx, ["steps", i], `WF-I8: step '${step.id}' cannot reach any terminal route target (@complete/@stop/@escalate/@handoff) through its routes graph \u2014 run bootstrapped from this step (or routed here) could never emit run.closed`);
      }
    }
    const stepsById = new Map(wf.steps.map((step) => [step.id, step]));
    for (let i = 0; i < wf.steps.length; i++) {
      const step = wf.steps[i];
      if (step === void 0)
        continue;
      const startId = step.id;
      const seen = /* @__PURE__ */ new Set();
      let cur = startId;
      while (cur !== void 0) {
        if (seen.has(cur)) {
          issueAt3(ctx, ["steps", i, "routes", RUNTIME_SUCCESS_ROUTE], `WF-I11: step '${startId}' cannot reach a terminal by following only routes.${RUNTIME_SUCCESS_ROUTE} \u2014 ${RUNTIME_SUCCESS_ROUTE} chain cycles at '${cur}'`);
          break;
        }
        seen.add(cur);
        const curStep = stepsById.get(cur);
        if (curStep === void 0)
          break;
        const passTarget = curStep.routes[RUNTIME_SUCCESS_ROUTE];
        if (passTarget === void 0)
          break;
        if (TERMINAL_ROUTE_TARGETS.has(passTarget))
          break;
        cur = passTarget;
      }
    }
    const reachableFromEntry = /* @__PURE__ */ new Set();
    const queue = [];
    for (const mode of wf.entry_modes) {
      if (mode === void 0)
        continue;
      queue.push(mode.start_at);
    }
    while (queue.length > 0) {
      const cur = queue.shift();
      if (cur === void 0)
        continue;
      if (reachableFromEntry.has(cur))
        continue;
      reachableFromEntry.add(cur);
      const targets = adjacency.get(cur) ?? [];
      for (const t of targets) {
        if (TERMINAL_ROUTE_TARGETS.has(t))
          continue;
        if (stepIds.has(t))
          queue.push(t);
      }
    }
    for (let i = 0; i < wf.steps.length; i++) {
      const step = wf.steps[i];
      if (step === void 0)
        continue;
      if (!reachableFromEntry.has(step.id)) {
        issueAt3(ctx, ["steps", i], `WF-I9: step '${step.id}' is not reachable from any entry_mode.start_at via the routes graph \u2014 declared but dead`);
      }
    }
  }
});
var CompiledFlow = external_exports.preprocess(normalizeCompiledFlowCompatibility, CompiledFlowStrict);

// dist/schemas/manifest.js
import { createHash as createHash2 } from "node:crypto";
var HEX643 = /^[0-9a-f]{64}$/;
var ManifestHash = external_exports.string().regex(HEX643, {
  message: "must be a 64-character lowercase hex SHA-256 digest"
});
var BASE64 = /^[A-Za-z0-9+/=\r\n]*$/;
var ManifestSnapshot = external_exports.object({
  schema_version: external_exports.literal(1),
  run_id: RunId,
  flow_id: CompiledFlowId,
  captured_at: external_exports.string().datetime(),
  algorithm: external_exports.literal("sha256-raw"),
  hash: ManifestHash,
  bytes_base64: external_exports.string().regex(BASE64, {
    message: "bytes_base64 must be base64-encoded (RFC 4648 alphabet)"
  })
}).strict().superRefine((snap, ctx) => {
  let decoded;
  try {
    decoded = Buffer.from(snap.bytes_base64, "base64");
  } catch {
    ctx.addIssue({
      code: external_exports.ZodIssueCode.custom,
      path: ["bytes_base64"],
      message: "bytes_base64 failed to decode as base64"
    });
    return;
  }
  const computed = createHash2("sha256").update(decoded).digest("hex");
  if (computed !== snap.hash) {
    ctx.addIssue({
      code: external_exports.ZodIssueCode.custom,
      path: ["hash"],
      message: `manifest hash mismatch: declared=${snap.hash} computed=${computed} (sha256 over decoded bytes_base64)`
    });
  }
});
function computeManifestHash(bytes) {
  return createHash2("sha256").update(bytes).digest("hex");
}

// dist/runtime/run/graph-runner.js
import { randomUUID as randomUUID3 } from "node:crypto";
import { lstat, mkdir as mkdir7, readdir } from "node:fs/promises";

// dist/runtime/domain/step.js
function isWaitingCheckpointStepOutcome(outcome) {
  return "kind" in outcome && outcome.kind === "waiting_checkpoint";
}

// dist/runtime/executors/checkpoint.js
import { readFileSync as readFileSync10 } from "node:fs";

// dist/shared/recovery-route.js
var RECOVERY_ROUTE_PRIORITY = [
  "retry",
  "revise",
  "ask",
  "stop",
  "handoff",
  "escalate"
];
function recoveryRouteForStep(step, allowedRoutes = RECOVERY_ROUTE_PRIORITY) {
  const allowed = new Set(allowedRoutes);
  return RECOVERY_ROUTE_PRIORITY.find((route) => allowed.has(route) && Object.hasOwn(step.routes, route));
}

// dist/runtime/run/route-compat.js
function requireCompiledFlow(context, step) {
  if (context.compiledFlow === void 0) {
    throw new Error(`step '${step.id}' requires compiled-flow v1 context for production ${step.kind} execution`);
  }
  return context.compiledFlow;
}
function requireCompiledStep(context, step, kind) {
  const flow = requireCompiledFlow(context, step);
  const compiledStep = flow.steps.find((candidate) => candidate.id === step.id);
  if (compiledStep === void 0) {
    throw new Error(`compiled-flow v1 context has no step '${step.id}'`);
  }
  if (compiledStep.kind !== kind) {
    throw new Error(`compiled-flow v1 step '${step.id}' has kind '${compiledStep.kind}', expected '${kind}'`);
  }
  return compiledStep;
}
function recoveryRouteForExecutableStep(step) {
  return recoveryRouteForStep(step);
}

// dist/runtime/executors/checkpoint.js
function policy(step) {
  if (step.policy === void 0 || step.policy === null || typeof step.policy !== "object") {
    throw new Error(`checkpoint step '${step.id}' is missing checkpoint policy`);
  }
  return step.policy;
}
function resolveCheckpoint(step, depth) {
  const effectiveDepth = depth ?? "standard";
  const stepPolicy = policy(step);
  if (effectiveDepth === "deep" || effectiveDepth === "tournament")
    return { kind: "waiting" };
  if (effectiveDepth === "autonomous") {
    const selection2 = stepPolicy.safe_autonomous_choice;
    if (selection2 === void 0) {
      return {
        kind: "failed",
        reason: `checkpoint step '${step.id}' cannot auto-resolve autonomous depth without a declared safe autonomous choice`
      };
    }
    return { kind: "resolved", selection: selection2, resolutionSource: "safe-autonomous", autoResolved: true };
  }
  const selection = stepPolicy.safe_default_choice;
  if (selection === void 0) {
    return {
      kind: "failed",
      reason: `checkpoint step '${step.id}' cannot resolve ${effectiveDepth} depth without a declared safe default choice`
    };
  }
  return { kind: "resolved", selection, resolutionSource: "safe-default", autoResolved: true };
}
function checkpointRequestBody(input) {
  const stepPolicy = policy(input.step);
  return {
    schema_version: 1,
    step_id: input.step.id,
    prompt: stepPolicy.prompt,
    allowed_choices: stepPolicy.choices.map((choice) => choice.id),
    ...stepPolicy.safe_default_choice === void 0 ? {} : { safe_default_choice: stepPolicy.safe_default_choice },
    ...stepPolicy.safe_autonomous_choice === void 0 ? {} : { safe_autonomous_choice: stepPolicy.safe_autonomous_choice },
    execution_context: {
      ...input.context.projectRoot === void 0 ? {} : { project_root: input.context.projectRoot },
      selection_config_layers: input.context.selectionConfigLayers ?? [],
      ...input.checkpointReportSha256 === void 0 ? {} : { checkpoint_report_sha256: input.checkpointReportSha256 }
    }
  };
}
async function executeCheckpoint(step, context) {
  const attempt = context.activeStepAttempt ?? 1;
  const request = step.writes?.request;
  const response = step.writes?.response;
  if (request === void 0 || response === void 0) {
    throw new Error(`checkpoint step '${step.id}' requires writes.request and writes.response`);
  }
  const compiledStep = requireCompiledStep(context, step, "checkpoint");
  let checkpointReportSha256;
  const report = step.writes?.report;
  const resumedSelection = context.resumeCheckpoint?.stepId === step.id ? context.resumeCheckpoint.selection : void 0;
  const resolution = resolveCheckpoint(step, context.depth);
  if (resumedSelection === void 0) {
    if (report !== void 0) {
      const builder = report.schema === void 0 ? void 0 : findCheckpointBriefBuilder(report.schema);
      if (builder === void 0 || report.schema === void 0) {
        throw new Error(`checkpoint step '${step.id}' has unsupported report schema`);
      }
      const body = builder.build({
        runFolder: context.runDir,
        step: compiledStep,
        goal: context.goal,
        responsePath: response.path
      });
      await context.files.writeJson(report, body);
      checkpointReportSha256 = sha256Hex(readFileSync10(context.files.resolve(report), "utf8"));
      await context.trace.append({
        run_id: context.runId,
        kind: "step.report_written",
        step_id: step.id,
        attempt,
        report_path: report.path,
        report_schema: report.schema
      });
    }
    const requestBody = checkpointRequestBody({
      step,
      context,
      ...checkpointReportSha256 === void 0 ? {} : { checkpointReportSha256 }
    });
    await context.files.writeJson(request, requestBody);
    const requestText = readFileSync10(context.files.resolve(request), "utf8");
    await context.trace.append({
      run_id: context.runId,
      kind: "checkpoint.requested",
      step_id: step.id,
      attempt,
      request_path: request.path,
      request_report_hash: sha256Hex(requestText),
      options: step.choices
    });
  }
  const effectiveResolution = resumedSelection === void 0 ? resolution : {
    kind: "resolved",
    selection: resumedSelection,
    resolutionSource: "operator",
    autoResolved: false
  };
  if (effectiveResolution.kind === "waiting") {
    return {
      kind: "waiting_checkpoint",
      checkpoint: {
        stepId: step.id,
        attempt,
        requestPath: context.files.resolve(request),
        allowedChoices: step.choices
      }
    };
  }
  if (effectiveResolution.kind === "failed") {
    await context.trace.append({
      run_id: context.runId,
      kind: "check.evaluated",
      step_id: step.id,
      attempt,
      check_kind: "checkpoint_selection",
      outcome: "fail",
      reason: effectiveResolution.reason
    });
    throw new Error(effectiveResolution.reason);
  }
  const allowed = step.check.allow;
  if (Array.isArray(allowed) && !allowed.includes(effectiveResolution.selection)) {
    throw new Error(`checkpoint step '${step.id}' selected '${effectiveResolution.selection}' but check.allow is [${allowed.join(", ")}]`);
  }
  await context.files.writeJson(response, {
    schema_version: 1,
    step_id: step.id,
    selection: effectiveResolution.selection,
    resolution_source: effectiveResolution.resolutionSource
  });
  await context.trace.append({
    run_id: context.runId,
    kind: "checkpoint.resolved",
    step_id: step.id,
    attempt,
    selection: effectiveResolution.selection,
    auto_resolved: effectiveResolution.autoResolved,
    resolution_source: effectiveResolution.resolutionSource,
    response_path: response.path
  });
  await context.trace.append({
    run_id: context.runId,
    kind: "check.evaluated",
    step_id: step.id,
    attempt,
    check_kind: "checkpoint_selection",
    outcome: "pass"
  });
  return {
    route: Object.hasOwn(step.routes, effectiveResolution.selection) ? effectiveResolution.selection : "pass",
    details: { selection: effectiveResolution.selection }
  };
}

// dist/runtime/executors/compose.js
import { readFileSync as readFileSync11 } from "node:fs";

// dist/flows/registries/close-writers/registry.js
var REGISTRY2 = buildCloseRegistry(flowPackages);
function findCloseBuilder(resultSchemaName) {
  return REGISTRY2.get(resultSchemaName);
}
function resolveCloseReadPaths(builder, flow, closeStep) {
  const paths = {};
  for (const descriptor of builder.reads) {
    if (descriptor.required) {
      const path = reportPathForSchemaInCompiledFlow(flow, descriptor.schema);
      if (!closeStep.reads.includes(path)) {
        throw new Error(`${closeStep.writes.report.schema} requires close step '${closeStep.id}' to read ${path}`);
      }
      paths[descriptor.name] = path;
    } else {
      if (!flowHasReportSchemaInCompiledFlow(flow, descriptor.schema)) {
        paths[descriptor.name] = void 0;
        continue;
      }
      const path = reportPathForSchemaInCompiledFlow(flow, descriptor.schema);
      paths[descriptor.name] = closeStep.reads.includes(path) ? path : void 0;
    }
  }
  return paths;
}

// dist/flows/registries/compose-writers/registry.js
var REGISTRY3 = buildComposeRegistry(flowPackages);
function findComposeBuilder(resultSchemaName) {
  return REGISTRY3.get(resultSchemaName);
}
function resolveComposeReadPaths(builder, flow, step) {
  const paths = {};
  if (builder.reads === void 0)
    return paths;
  for (const descriptor of builder.reads) {
    const path = reportPathForSchemaInCompiledFlow(flow, descriptor.schema);
    if (descriptor.required && !step.reads.includes(path)) {
      throw new Error(`${step.writes.report.schema} requires step '${step.id}' to read ${path}`);
    }
    paths[descriptor.name] = step.reads.includes(path) ? path : void 0;
  }
  return paths;
}

// dist/runtime/executors/compose.js
function readJsonReport(context, path) {
  return JSON.parse(readFileSync11(context.files.resolve(path), "utf8"));
}
async function writeRegisteredComposeReport(step, context) {
  const report = step.writes?.report;
  if (report?.schema === void 0)
    return false;
  const flow = requireCompiledFlow(context, step);
  const compiledStep = requireCompiledStep(context, step, "compose");
  const composeBuilder = findComposeBuilder(report.schema);
  if (composeBuilder !== void 0) {
    const readPaths = resolveComposeReadPaths(composeBuilder, flow, compiledStep);
    const inputs = {};
    for (const [name, path] of Object.entries(readPaths)) {
      inputs[name] = path === void 0 ? void 0 : readJsonReport(context, path);
    }
    const body = composeBuilder.build({
      runFolder: context.runDir,
      flow,
      step: compiledStep,
      goal: context.goal,
      ...context.projectRoot === void 0 ? {} : { projectRoot: context.projectRoot },
      ...context.evidencePolicy === void 0 ? {} : { evidencePolicy: context.evidencePolicy },
      inputs
    });
    await context.files.writeJson(report, body);
    return true;
  }
  const closeBuilder = findCloseBuilder(report.schema);
  if (closeBuilder !== void 0) {
    const readPaths = resolveCloseReadPaths(closeBuilder, flow, compiledStep);
    const inputs = {};
    for (const [name, path] of Object.entries(readPaths)) {
      inputs[name] = path === void 0 ? void 0 : readJsonReport(context, path);
    }
    const body = closeBuilder.build({
      runFolder: context.runDir,
      flow,
      closeStep: compiledStep,
      goal: context.goal,
      inputs
    });
    await context.files.writeJson(report, body);
    return true;
  }
  throw new Error(`no compose report writer registered for schema '${report.schema}' at compose step '${step.id}'`);
}
async function executeCompose(step, context) {
  if (step.writes?.report?.schema !== void 0 && context.compiledFlow !== void 0) {
    await writeRegisteredComposeReport(step, context);
    await context.trace.append({
      run_id: context.runId,
      kind: "step.report_written",
      step_id: step.id,
      attempt: context.activeStepAttempt ?? 1,
      report_path: step.writes.report.path,
      report_schema: step.writes.report.schema
    });
    return { route: "pass", details: { writer: step.writer } };
  }
  const body = step.body ?? { stepId: step.id, writer: step.writer };
  const writes = step.writes ?? {};
  await Promise.all(Object.values(writes).map((ref) => context.files.writeJson(ref, {
    stepId: step.id,
    writer: step.writer,
    body
  })));
  return { route: "pass", details: { writer: step.writer } };
}

// dist/runtime/executors/fanout.js
import { join as joinPath } from "node:path";

// dist/shared/fanout-aggregate-report.js
function buildFanoutAggregate(policy2, outcomes, winnerBranchId) {
  return {
    schema_version: 1,
    join_policy: policy2,
    branch_count: outcomes.length,
    ...winnerBranchId === void 0 ? {} : { winner_branch_id: winnerBranchId },
    branches: outcomes.map((outcome) => ({
      branch_id: outcome.branch_id,
      child_run_id: outcome.child_run_id,
      child_outcome: outcome.child_outcome,
      verdict: outcome.verdict,
      admitted: outcome.admitted,
      result_path: outcome.result_path,
      duration_ms: outcome.duration_ms,
      ...outcome.result_body === void 0 ? {} : { result_body: outcome.result_body }
    }))
  };
}

// dist/shared/fanout-join-policy.js
function evaluateFanoutJoinPolicy(input) {
  const { policy: policy2, stepId, admitOrder: admitOrder2, outcomes } = input;
  if (policy2 === "pick-winner") {
    for (const admittedVerdict of admitOrder2) {
      const found = outcomes.find((outcome) => outcome.child_outcome === "complete" && outcome.verdict === admittedVerdict);
      if (found !== void 0) {
        return { joinedSuccessfully: true, winnerBranchId: found.branch_id };
      }
    }
    return {
      joinedSuccessfully: false,
      failureReason: `fanout step '${stepId}' pick-winner: no branch closed 'complete' with an admitted verdict (admit order [${admitOrder2.join(", ")}])`
    };
  }
  if (policy2 === "disjoint-merge") {
    if (!outcomes.every((outcome) => outcome.admitted)) {
      return {
        joinedSuccessfully: false,
        failureReason: `fanout step '${stepId}' disjoint-merge: not all branches closed 'complete' with an admitted verdict`
      };
    }
    if (input.branchFilesError !== void 0) {
      return {
        joinedSuccessfully: false,
        failureReason: `fanout step '${stepId}' disjoint-merge: file-disjoint validation failed (${input.branchFilesError})`
      };
    }
    const branchFiles = input.branchFiles;
    if (branchFiles === void 0) {
      throw new Error("evaluateFanoutJoinPolicy: disjoint-merge requires branchFiles or branchFilesError");
    }
    const seenFile = /* @__PURE__ */ new Map();
    for (const outcome of outcomes) {
      const files = branchFiles.get(outcome.branch_id) ?? [];
      for (const file of files) {
        const prior = seenFile.get(file);
        if (prior !== void 0 && prior !== outcome.branch_id) {
          return {
            joinedSuccessfully: false,
            failureReason: `fanout step '${stepId}' disjoint-merge: file '${file}' modified by branches '${prior}' and '${outcome.branch_id}'`
          };
        }
        seenFile.set(file, outcome.branch_id);
      }
    }
    return { joinedSuccessfully: true };
  }
  const allClosed = outcomes.every((outcome) => ["complete", "aborted", "handoff", "stopped", "escalated"].includes(outcome.child_outcome));
  const allParseable = outcomes.every((outcome) => outcome.child_outcome === "complete" && outcome.result_body !== void 0);
  if (!allClosed) {
    return {
      joinedSuccessfully: false,
      failureReason: `fanout step '${stepId}' aggregate-only: at least one branch did not close cleanly`
    };
  }
  if (!allParseable) {
    const failedOutcome = outcomes.find((outcome) => outcome.failure_reason !== void 0);
    return {
      joinedSuccessfully: false,
      failureReason: failedOutcome?.failure_reason === void 0 ? `fanout step '${stepId}' aggregate-only: at least one branch did not produce a parseable result body` : `fanout step '${stepId}' aggregate-only: ${failedOutcome.failure_reason}`
    };
  }
  return { joinedSuccessfully: true };
}

// dist/runtime/fanout/branch-execution.js
import { randomUUID } from "node:crypto";
import { mkdir as mkdir3, readFile as readFile3, writeFile as writeFile3 } from "node:fs/promises";
import { dirname as dirname2, join as join4 } from "node:path";

// dist/flows/registries/cross-report-validators.js
var REGISTRY4 = buildCrossReportValidatorRegistry(flowPackages);
function runCrossReportValidator(schemaName, flow, runFolder, resultBody) {
  const validator = REGISTRY4.get(schemaName);
  if (validator === void 0)
    return { kind: "ok" };
  return validator(flow, runFolder, resultBody);
}

// dist/flows/registries/report-schemas.js
var MinimalVerdictShape = external_exports.object({ verdict: external_exports.string().min(1) }).passthrough();
var StrictPayloadShape = external_exports.object({
  verdict: external_exports.string().min(1),
  rationale: external_exports.string().min(1)
}).strict();
var FanoutAggregateFixtureBranchShape = external_exports.object({
  branch_id: external_exports.string().min(1),
  child_run_id: external_exports.string().min(1),
  child_outcome: external_exports.string().min(1),
  verdict: external_exports.string().min(1),
  admitted: external_exports.boolean(),
  result_path: external_exports.string().min(1),
  duration_ms: external_exports.number().nonnegative()
}).passthrough();
var FanoutAggregateFixtureShape = external_exports.object({
  schema_version: external_exports.literal(1),
  join_policy: external_exports.enum(["pick-winner", "disjoint-merge", "aggregate-only"]),
  branch_count: external_exports.number().int().nonnegative(),
  winner_branch_id: external_exports.string().min(1).optional(),
  branches: external_exports.array(FanoutAggregateFixtureBranchShape)
}).passthrough();
var TEST_FIXTURE_SCHEMAS = Object.freeze({
  "runtime-proof-canonical@v1": MinimalVerdictShape,
  "runtime-proof-strict@v1": StrictPayloadShape,
  "fanout-aggregate@v1": FanoutAggregateFixtureShape
});
var REGISTRY5 = buildReportSchemaRegistry(flowPackages, TEST_FIXTURE_SCHEMAS);
function parseReport(schemaName, resultBody) {
  if (!Object.hasOwn(REGISTRY5, schemaName)) {
    return {
      kind: "fail",
      reason: `report schema '${schemaName}' is not registered in the report-schema registry (fail-closed default)`
    };
  }
  const schema = REGISTRY5[schemaName];
  let parsed;
  try {
    parsed = JSON.parse(resultBody);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      kind: "fail",
      reason: `report body did not parse as JSON against schema '${schemaName}' (${msg})`
    };
  }
  const result = schema.safeParse(parsed);
  if (!result.success) {
    const issueSummary = result.error.issues.map((issue) => {
      const path = issue.path.length > 0 ? issue.path.join(".") : "<root>";
      return `${path}: ${issue.message}`;
    }).join("; ");
    return {
      kind: "fail",
      reason: `report body did not validate against schema '${schemaName}' (${issueSummary})`
    };
  }
  return { kind: "ok" };
}

// dist/runtime/executors/relay.js
import { mkdir as mkdir2, writeFile as writeFile2 } from "node:fs/promises";
import { dirname } from "node:path";

// dist/connectors/claude-code.js
import { spawn } from "node:child_process";
import { performance } from "node:perf_hooks";

// dist/shared/connector-helpers.js
function selectedModelForProvider(connectorName, selection, expectedProvider2) {
  const model = selection?.model;
  if (model === void 0)
    return void 0;
  if (model.provider !== expectedProvider2) {
    throw new Error(`${connectorName} connector cannot honor model provider '${model.provider}' for model '${model.model}'; expected provider '${expectedProvider2}'`);
  }
  return model.model;
}
function extractJsonObject(text) {
  let cursor = 0;
  while (cursor < text.length) {
    const start = text.indexOf("{", cursor);
    if (start === -1)
      break;
    let depth = 0;
    let inString = false;
    let escaped = false;
    let end = -1;
    for (let i = start; i < text.length; i++) {
      const ch = text[i];
      if (escaped) {
        escaped = false;
        continue;
      }
      if (inString) {
        if (ch === "\\") {
          escaped = true;
          continue;
        }
        if (ch === '"')
          inString = false;
        continue;
      }
      if (ch === '"') {
        inString = true;
        continue;
      }
      if (ch === "{")
        depth++;
      else if (ch === "}") {
        depth--;
        if (depth === 0) {
          end = i + 1;
          break;
        }
      }
    }
    if (end === -1)
      break;
    const candidate = text.slice(start, end);
    try {
      JSON.parse(candidate);
      return candidate;
    } catch {
      cursor = start + 1;
    }
  }
  return text;
}

// dist/connectors/claude-code.js
var CLAUDE_CODE_DISPATCH_FLAGS = [
  "-p",
  "--permission-mode",
  "bypassPermissions",
  "--strict-mcp-config",
  "--disable-slash-commands",
  "--setting-sources",
  "",
  "--settings",
  "{}",
  "--output-format",
  "stream-json",
  "--verbose",
  "--no-session-persistence"
];
var CLAUDE_CODE_EXECUTABLE = "claude";
var CLAUDE_CODE_SUPPORTED_EFFORTS = ["low", "medium", "high", "xhigh"];
var DEFAULT_TIMEOUT_MS = 6e5;
var SIGTERM_TO_SIGKILL_GRACE_MS = 2e3;
var STDOUT_MAX_BYTES = 16 * 1024 * 1024;
var STDERR_MAX_BYTES = 1024 * 1024;
function assertClaudeCodeEffort(effort) {
  if (!CLAUDE_CODE_SUPPORTED_EFFORTS.includes(effort)) {
    throw new Error(`claude-code connector cannot honor effort '${effort}'; supported efforts: ${CLAUDE_CODE_SUPPORTED_EFFORTS.join(", ")}`);
  }
}
function buildClaudeCodeArgs(input) {
  const args = [...CLAUDE_CODE_DISPATCH_FLAGS];
  const model = selectedModelForProvider("claude-code", input.resolvedSelection, "anthropic");
  if (model !== void 0) {
    args.push("--model", model);
  }
  const effort = input.resolvedSelection?.effort;
  if (effort !== void 0) {
    assertClaudeCodeEffort(effort);
    args.push("--effort", effort);
  }
  args.push(input.prompt);
  return args;
}
async function relayClaudeCode(input) {
  const timeoutMs2 = input.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const args = buildClaudeCodeArgs(input);
  const start = performance.now();
  return await new Promise((resolve13, reject) => {
    let child;
    try {
      child = spawn(CLAUDE_CODE_EXECUTABLE, args, {
        stdio: ["ignore", "pipe", "pipe"],
        // Inherit the parent process's environment explicitly. Some test
        // harnesses (vitest workers) launch children through a process-
        // pool whose env may not be identical to the top-level node
        // process's env; passing `process.env` directly makes the
        // auth/session inheritance unambiguous.
        env: process.env,
        detached: true
      });
    } catch (err) {
      reject(new Error(`claude-code subprocess spawn failed: ${err.message}`));
      return;
    }
    let stdout = "";
    let stdoutBytes = 0;
    let stderr = "";
    let stderrBytes = 0;
    let stdoutCapped = false;
    let stderrCapped = false;
    let timedOut = false;
    let killGroupSucceeded = false;
    const killProcessGroup = (signal) => {
      const pid = child.pid;
      if (typeof pid !== "number")
        return false;
      try {
        process.kill(-pid, signal);
        return true;
      } catch {
        try {
          child.kill(signal);
          return true;
        } catch {
          return false;
        }
      }
    };
    const timer = setTimeout(() => {
      timedOut = true;
      killGroupSucceeded = killProcessGroup("SIGTERM");
      setTimeout(() => {
        killProcessGroup("SIGKILL");
      }, SIGTERM_TO_SIGKILL_GRACE_MS);
    }, timeoutMs2);
    child.stdout?.setEncoding("utf8");
    child.stderr?.setEncoding("utf8");
    child.stdout?.on("data", (chunk) => {
      if (stdoutBytes + chunk.length > STDOUT_MAX_BYTES) {
        stdoutCapped = true;
        return;
      }
      stdout += chunk;
      stdoutBytes += chunk.length;
    });
    child.stderr?.on("data", (chunk) => {
      if (stderrBytes + chunk.length > STDERR_MAX_BYTES) {
        stderrCapped = true;
        return;
      }
      stderr += chunk;
      stderrBytes += chunk.length;
    });
    child.on("error", (err) => {
      clearTimeout(timer);
      reject(new Error(`claude-code subprocess spawn error: ${err.message}`));
    });
    child.on("close", (code, signal) => {
      clearTimeout(timer);
      const duration_ms = performance.now() - start;
      if (timedOut) {
        reject(new Error(`claude-code subprocess timed out after ${timeoutMs2}ms; group-kill ${killGroupSucceeded ? "sent" : "failed"}; final signal=${signal ?? "none"}; stderr[:500]=${stderr.slice(0, 500)}`));
        return;
      }
      if (code !== 0) {
        reject(new Error(`claude-code subprocess exited with code ${code}${signal ? ` (signal ${signal})` : ""}; stderr[:500]=${stderr.slice(0, 500)}`));
        return;
      }
      if (stdoutCapped) {
        reject(new Error(`claude-code subprocess stdout exceeded ${STDOUT_MAX_BYTES} bytes; capability-boundary check cannot be evaluated on truncated stream`));
        return;
      }
      try {
        resolve13(parseClaudeCodeStdout(stdout, input.prompt, duration_ms));
      } catch (err) {
        const stderrSuffix = stderrCapped ? " [stderr capped]" : "";
        reject(new Error(`claude-code subprocess: ${err.message}; stdout[:500]=${stdout.slice(0, 500)}; stderr[:200]=${stderr.slice(0, 200)}${stderrSuffix}`));
      }
    });
  });
}
function parseClaudeCodeStdout(stdout, prompt, duration_ms) {
  const lines = stdout.split("\n").filter((line) => line.length > 0);
  if (lines.length === 0) {
    throw new Error("stream-json stdout is empty");
  }
  const trace_entries = [];
  for (const [idx, line] of lines.entries()) {
    let parsed;
    try {
      parsed = JSON.parse(line);
    } catch (err) {
      throw new Error(`stream-json line ${idx + 1} is not valid JSON: ${err.message}; line[:200]=${line.slice(0, 200)}`);
    }
    if (typeof parsed !== "object" || parsed === null) {
      throw new Error(`stream-json line ${idx + 1} is not a JSON object`);
    }
    trace_entries.push(parsed);
  }
  const initTraceEntry = trace_entries.find((e) => e.type === "system" && e.subtype === "init");
  const resultTraceEntries = trace_entries.filter((e) => e.type === "result");
  const resultTraceEntry = resultTraceEntries[resultTraceEntries.length - 1];
  if (initTraceEntry === void 0) {
    throw new Error("system/init trace_entry missing from subprocess stdout");
  }
  if (resultTraceEntry === void 0) {
    throw new Error("result trace_entry missing from subprocess stdout");
  }
  if (resultTraceEntry.is_error === true) {
    const message = typeof resultTraceEntry.result === "string" ? resultTraceEntry.result : "<no message>";
    throw new Error(`subprocess reported is_error: ${message}`);
  }
  const mcpServers = initTraceEntry.mcp_servers;
  const slashCommands = initTraceEntry.slash_commands;
  if (!Array.isArray(mcpServers) || mcpServers.length !== 0) {
    throw new Error(`init.mcp_servers must be []; got ${JSON.stringify(mcpServers)}. CLAUDE_CODE_DISPATCH_FLAGS includes --strict-mcp-config to keep this surface closed.`);
  }
  if (!Array.isArray(slashCommands) || slashCommands.length !== 0) {
    throw new Error(`init.slash_commands must be []; got ${JSON.stringify(slashCommands)}. CLAUDE_CODE_DISPATCH_FLAGS includes --disable-slash-commands to keep this surface closed.`);
  }
  const receipt_id = initTraceEntry.session_id;
  const result_body_raw = resultTraceEntry.result;
  const cli_version = initTraceEntry.claude_code_version;
  if (typeof receipt_id !== "string" || receipt_id.length === 0) {
    throw new Error("init.session_id missing or empty");
  }
  if (typeof result_body_raw !== "string") {
    throw new Error("result.result missing or not a string");
  }
  if (typeof cli_version !== "string" || cli_version.length === 0) {
    throw new Error("init.claude_code_version missing or empty");
  }
  const result_body = extractJsonObject(result_body_raw);
  return {
    request_payload: prompt,
    receipt_id,
    result_body,
    duration_ms,
    cli_version
  };
}

// dist/connectors/codex.js
import { execFileSync, spawn as spawn2 } from "node:child_process";
import { performance as performance2 } from "node:perf_hooks";
var CODEX_NO_WRITE_FLAGS = Object.freeze([
  "exec",
  "--json",
  "-s",
  "read-only",
  "--ephemeral",
  "--skip-git-repo-check"
]);
var CODEX_EXECUTABLE = "codex";
var CODEX_FORBIDDEN_ARGV_TOKENS = Object.freeze([
  "--dangerously-bypass-approvals-and-sandbox",
  "--full-auto",
  "--add-dir",
  "-o",
  "--output-last-message",
  "-c",
  "--config",
  "-p",
  "--profile",
  "--sandbox"
]);
var CODEX_REASONING_EFFORT_CONFIG_KEY = "model_reasoning_effort";
var CODEX_SUPPORTED_EFFORTS = ["low", "medium", "high", "xhigh"];
if (!CODEX_NO_WRITE_FLAGS.includes("-s") || !CODEX_NO_WRITE_FLAGS.includes("read-only")) {
  throw new Error('CODEX_NO_WRITE_FLAGS capability-boundary invariant broken: must include "-s read-only"');
}
var flagsAsStringArray = CODEX_NO_WRITE_FLAGS;
for (const forbidden of CODEX_FORBIDDEN_ARGV_TOKENS) {
  if (flagsAsStringArray.includes(forbidden)) {
    throw new Error(`CODEX_NO_WRITE_FLAGS capability-boundary invariant broken: must NOT include "${forbidden}" (forbidden-token set)`);
  }
}
var DEFAULT_TIMEOUT_MS2 = 12e4;
var SIGTERM_TO_SIGKILL_GRACE_MS2 = 2e3;
var STDOUT_MAX_BYTES2 = 16 * 1024 * 1024;
var STDERR_MAX_BYTES2 = 1024 * 1024;
var VERSION_CAPTURE_TIMEOUT_MS = 5e3;
var cachedCodexVersion;
function captureCodexVersion() {
  if (cachedCodexVersion !== void 0)
    return cachedCodexVersion;
  let stdout;
  try {
    stdout = execFileSync(CODEX_EXECUTABLE, ["--version"], {
      encoding: "utf8",
      timeout: VERSION_CAPTURE_TIMEOUT_MS,
      stdio: ["ignore", "pipe", "pipe"]
    });
  } catch (err) {
    throw new Error(`codex --version failed: ${err.message}`);
  }
  const version = stdout.trim();
  if (version.length === 0) {
    throw new Error("codex --version produced empty output");
  }
  cachedCodexVersion = version;
  return version;
}
function assertCodexEffort(effort) {
  if (!CODEX_SUPPORTED_EFFORTS.includes(effort)) {
    throw new Error(`codex connector cannot honor effort '${effort}'; supported efforts: ${CODEX_SUPPORTED_EFFORTS.join(", ")}`);
  }
}
function codexReasoningEffortConfigValue(effort) {
  return `${CODEX_REASONING_EFFORT_CONFIG_KEY}=${JSON.stringify(effort)}`;
}
function isForbiddenCodexArg(arg) {
  return CODEX_FORBIDDEN_ARGV_TOKENS.some((token) => {
    if (token === "-c")
      return false;
    if (arg === token)
      return true;
    return token.startsWith("--") && arg.startsWith(`${token}=`);
  });
}
function isAllowedCodexConfigOverride(value) {
  return value !== void 0 && CODEX_SUPPORTED_EFFORTS.some((effort) => value === codexReasoningEffortConfigValue(effort));
}
function assertCodexSpawnArgvBoundary(args) {
  const sandboxFlagIndexes = args.map((arg, idx) => arg === "-s" ? idx : -1).filter((idx) => idx >= 0);
  const sandboxFlagIndex = sandboxFlagIndexes[0];
  if (sandboxFlagIndexes.length !== 1 || sandboxFlagIndex === void 0 || args[sandboxFlagIndex + 1] !== "read-only") {
    throw new Error('codex spawn argv boundary broken: exactly one "-s read-only" pair is required');
  }
  let configOverrideCount = 0;
  for (let idx = 0; idx < args.length; idx += 1) {
    const arg = args[idx];
    if (arg === void 0)
      continue;
    if (arg === "-c") {
      configOverrideCount += 1;
      if (configOverrideCount > 1) {
        throw new Error("codex spawn argv boundary broken: at most one allowlisted -c override is allowed");
      }
      const value = args[idx + 1];
      if (!isAllowedCodexConfigOverride(value)) {
        throw new Error(`codex spawn argv boundary broken: only ${CODEX_REASONING_EFFORT_CONFIG_KEY}=<supported effort> is allowed after -c`);
      }
      idx += 1;
      continue;
    }
    if (isForbiddenCodexArg(arg)) {
      throw new Error(`codex spawn argv boundary broken: forbidden argv token "${arg}"`);
    }
  }
}
function buildCodexArgs(input) {
  const args = [...CODEX_NO_WRITE_FLAGS];
  const model = selectedModelForProvider("codex", input.resolvedSelection, "openai");
  if (model !== void 0) {
    args.push("-m", model);
  }
  const effort = input.resolvedSelection?.effort;
  if (effort !== void 0) {
    assertCodexEffort(effort);
    args.push("-c", codexReasoningEffortConfigValue(effort));
  }
  args.push(input.prompt);
  assertCodexSpawnArgvBoundary(args);
  return args;
}
async function relayCodex(input) {
  const timeoutMs2 = input.timeoutMs ?? DEFAULT_TIMEOUT_MS2;
  const cli_version = captureCodexVersion();
  const args = buildCodexArgs(input);
  const start = performance2.now();
  return await new Promise((resolve13, reject) => {
    let child;
    try {
      child = spawn2(CODEX_EXECUTABLE, args, {
        stdio: ["ignore", "pipe", "pipe"],
        env: process.env,
        detached: true
      });
    } catch (err) {
      reject(new Error(`codex subprocess spawn failed: ${err.message}`));
      return;
    }
    let stdout = "";
    let stdoutBytes = 0;
    let stderr = "";
    let stderrBytes = 0;
    let stdoutCapped = false;
    let stderrCapped = false;
    let timedOut = false;
    let killGroupSucceeded = false;
    const killProcessGroup = (signal) => {
      const pid = child.pid;
      if (typeof pid !== "number")
        return false;
      try {
        process.kill(-pid, signal);
        return true;
      } catch {
        try {
          child.kill(signal);
          return true;
        } catch {
          return false;
        }
      }
    };
    let killGraceTimer;
    const timer = setTimeout(() => {
      timedOut = true;
      killGroupSucceeded = killProcessGroup("SIGTERM");
      killGraceTimer = setTimeout(() => {
        killProcessGroup("SIGKILL");
        killGraceTimer = void 0;
      }, SIGTERM_TO_SIGKILL_GRACE_MS2);
    }, timeoutMs2);
    const clearAllTimers = () => {
      clearTimeout(timer);
      if (killGraceTimer !== void 0) {
        clearTimeout(killGraceTimer);
        killGraceTimer = void 0;
      }
    };
    child.stdout?.setEncoding("utf8");
    child.stderr?.setEncoding("utf8");
    child.stdout?.on("data", (chunk) => {
      if (stdoutBytes + chunk.length > STDOUT_MAX_BYTES2) {
        stdoutCapped = true;
        return;
      }
      stdout += chunk;
      stdoutBytes += chunk.length;
    });
    child.stderr?.on("data", (chunk) => {
      if (stderrBytes + chunk.length > STDERR_MAX_BYTES2) {
        stderrCapped = true;
        return;
      }
      stderr += chunk;
      stderrBytes += chunk.length;
    });
    child.on("error", (err) => {
      clearAllTimers();
      reject(new Error(`codex subprocess spawn error: ${err.message}`));
    });
    child.on("close", (code, signal) => {
      clearAllTimers();
      const duration_ms = performance2.now() - start;
      if (timedOut) {
        reject(new Error(`codex subprocess timed out after ${timeoutMs2}ms; group-kill ${killGroupSucceeded ? "sent" : "failed"}; final signal=${signal ?? "none"}; stderr[:500]=${stderr.slice(0, 500)}`));
        return;
      }
      if (code !== 0) {
        reject(new Error(`codex subprocess exited with code ${code}${signal ? ` (signal ${signal})` : ""}; stderr[:500]=${stderr.slice(0, 500)}`));
        return;
      }
      if (stdoutCapped) {
        reject(new Error(`codex subprocess stdout exceeded ${STDOUT_MAX_BYTES2} bytes; capability-boundary check cannot be evaluated on truncated stream`));
        return;
      }
      try {
        resolve13(parseCodexStdout(stdout, input.prompt, duration_ms, cli_version));
      } catch (err) {
        const stderrSuffix = stderrCapped ? " [stderr capped]" : "";
        reject(new Error(`codex subprocess: ${err.message}; stdout[:500]=${stdout.slice(0, 500)}; stderr[:200]=${stderr.slice(0, 200)}${stderrSuffix}`));
      }
    });
  });
}
var KNOWN_CODEX_ITEM_TYPES = /* @__PURE__ */ new Set(["agent_message", "command_execution", "reasoning"]);
var KNOWN_CODEX_EVENT_TYPES = /* @__PURE__ */ new Set([
  "thread.started",
  "turn.started",
  "item.started",
  "item.updated",
  "item.completed",
  "turn.completed"
]);
var CODEX_FAILURE_EVENT_TYPES = /* @__PURE__ */ new Set(["turn.failed", "error"]);
function parseCodexStdout(stdout, prompt, duration_ms, cli_version) {
  const lines = stdout.split("\n").filter((line) => line.length > 0);
  if (lines.length === 0) {
    throw new Error("codex --json stdout is empty");
  }
  const trace_entries = [];
  for (const [idx, line] of lines.entries()) {
    let parsed;
    try {
      parsed = JSON.parse(line);
    } catch (err) {
      throw new Error(`codex --json line ${idx + 1} is not valid JSON: ${err.message}; line[:200]=${line.slice(0, 200)}`);
    }
    if (typeof parsed !== "object" || parsed === null) {
      throw new Error(`codex --json line ${idx + 1} is not a JSON object`);
    }
    trace_entries.push(parsed);
  }
  for (const [idx, trace_entry] of trace_entries.entries()) {
    const type = trace_entry.type;
    if (typeof type !== "string") {
      throw new Error(`codex --json line ${idx + 1}: trace_entry has no string 'type' field`);
    }
    if (CODEX_FAILURE_EVENT_TYPES.has(type)) {
      const msgField = typeof trace_entry.message === "string" ? trace_entry.message : typeof trace_entry.error === "string" ? trace_entry.error : JSON.stringify(trace_entry).slice(0, 200);
      throw new Error(`codex reported ${type}: ${msgField}. If this recurs, examine whether the failure shape indicates a capability-boundary regression (e.g., a sandboxed write attempt surfacing as turn.failed).`);
    }
    if (!KNOWN_CODEX_EVENT_TYPES.has(type)) {
      throw new Error(`codex --json line ${idx + 1}: unknown top-level trace_entry type '${type}' (allowlist: ${Array.from(KNOWN_CODEX_EVENT_TYPES).join(", ")}). A new Codex trace_entry type must be reviewed before the connector admits it.`);
    }
  }
  const threadStarted = trace_entries.find((e) => e.type === "thread.started");
  if (threadStarted === void 0) {
    throw new Error("thread.started trace_entry missing from codex --json stdout");
  }
  const thread_id = threadStarted.thread_id;
  if (typeof thread_id !== "string" || thread_id.length === 0) {
    throw new Error("thread.started.thread_id missing or empty");
  }
  const turnCompleted = trace_entries.find((e) => e.type === "turn.completed");
  if (turnCompleted === void 0) {
    throw new Error("turn.completed trace_entry missing from codex --json stdout");
  }
  const itemCompleted = trace_entries.filter((e) => e.type === "item.completed");
  for (const [idx, e] of itemCompleted.entries()) {
    const item2 = e.item;
    if (typeof item2 !== "object" || item2 === null) {
      throw new Error(`item.completed[${idx}].item is not an object`);
    }
    const itemType = item2.type;
    if (typeof itemType !== "string") {
      throw new Error(`item.completed[${idx}].item.type is not a string`);
    }
    if (!KNOWN_CODEX_ITEM_TYPES.has(itemType)) {
      throw new Error(`capability-boundary violation: item.completed[${idx}].item.type='${itemType}' is not in the known-types allowlist (${Array.from(KNOWN_CODEX_ITEM_TYPES).join(", ")}). A new Codex item type must be reviewed before the connector admits it.`);
    }
  }
  const itemUpdated = trace_entries.filter((e) => e.type === "item.updated");
  for (const [idx, e] of itemUpdated.entries()) {
    const item2 = e.item;
    if (typeof item2 !== "object" || item2 === null) {
      throw new Error(`item.updated[${idx}].item is not an object`);
    }
    const itemType = item2.type;
    if (typeof itemType !== "string") {
      throw new Error(`item.updated[${idx}].item.type is not a string`);
    }
    if (!KNOWN_CODEX_ITEM_TYPES.has(itemType)) {
      throw new Error(`capability-boundary violation: item.updated[${idx}].item.type='${itemType}' is not in the known-types allowlist (${Array.from(KNOWN_CODEX_ITEM_TYPES).join(", ")}). A new Codex item type must be reviewed before the connector admits it.`);
    }
  }
  const agentMessages = itemCompleted.filter((e) => {
    const item2 = e.item;
    return item2.type === "agent_message";
  });
  const terminalMessage = agentMessages[agentMessages.length - 1];
  if (terminalMessage === void 0) {
    throw new Error("no item.completed/agent_message trace_entry found in codex --json stdout");
  }
  const item = terminalMessage.item;
  const result_body_raw = item.text;
  if (typeof result_body_raw !== "string") {
    throw new Error("terminal agent_message item.text missing or not a string");
  }
  const result_body = extractJsonObject(result_body_raw);
  return {
    request_payload: prompt,
    receipt_id: thread_id,
    result_body,
    duration_ms,
    cli_version
  };
}

// dist/connectors/custom.js
import { spawn as spawn3 } from "node:child_process";
import { mkdtemp, readFile as readFile2, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join as join2 } from "node:path";
import { performance as performance3 } from "node:perf_hooks";
var DEFAULT_TIMEOUT_MS3 = 12e4;
var SIGTERM_TO_SIGKILL_GRACE_MS3 = 2e3;
var OUTPUT_MAX_BYTES = 16 * 1024 * 1024;
var STDOUT_MAX_BYTES3 = 16 * 1024 * 1024;
var STDERR_MAX_BYTES3 = 1024 * 1024;
async function extractConfiguredOutput(descriptor, outputFile) {
  const outputStats = await stat(outputFile);
  if (outputStats.size > OUTPUT_MAX_BYTES) {
    throw new Error(`custom connector '${descriptor.name}' output file exceeded ${OUTPUT_MAX_BYTES} bytes`);
  }
  const raw = await readFile2(outputFile, "utf8");
  if (raw.trim().length === 0) {
    throw new Error(`custom connector '${descriptor.name}' output file was empty`);
  }
  return {
    receiptId: `custom:${descriptor.name}:${Date.now()}`,
    resultBody: extractJsonObject(raw)
  };
}
async function relayCustom(input) {
  const { descriptor } = input;
  if (descriptor.prompt_transport !== "prompt-file") {
    throw new Error(`custom connector '${descriptor.name}' prompt transport '${descriptor.prompt_transport}' is not implemented`);
  }
  const [executable, ...baseArgs] = descriptor.command;
  if (executable === void 0) {
    throw new Error(`custom connector '${descriptor.name}' command is empty`);
  }
  const tempDir = await mkdtemp(join2(tmpdir(), "circuit-custom-connector-"));
  const promptFile = join2(tempDir, "prompt.txt");
  const outputFile = join2(tempDir, "output.txt");
  await writeFile(promptFile, input.prompt, "utf8");
  const args = [...baseArgs, promptFile, outputFile];
  const timeoutMs2 = input.timeoutMs ?? DEFAULT_TIMEOUT_MS3;
  const start = performance3.now();
  try {
    return await new Promise((resolve13, reject) => {
      let child;
      try {
        child = spawn3(executable, args, {
          stdio: ["ignore", "pipe", "pipe"],
          env: process.env,
          detached: true
        });
      } catch (err) {
        reject(new Error(`custom connector '${descriptor.name}' spawn failed: ${err.message}`));
        return;
      }
      let stdout = "";
      let stdoutBytes = 0;
      let stderr = "";
      let stderrBytes = 0;
      let stdoutCapped = false;
      let stderrCapped = false;
      let timedOut = false;
      let killGroupSucceeded = false;
      const killProcessGroup = (signal) => {
        const pid = child.pid;
        if (typeof pid !== "number")
          return false;
        try {
          process.kill(-pid, signal);
          return true;
        } catch {
          try {
            child.kill(signal);
            return true;
          } catch {
            return false;
          }
        }
      };
      const timer = setTimeout(() => {
        timedOut = true;
        killGroupSucceeded = killProcessGroup("SIGTERM");
        setTimeout(() => {
          killProcessGroup("SIGKILL");
        }, SIGTERM_TO_SIGKILL_GRACE_MS3);
      }, timeoutMs2);
      child.stdout?.setEncoding("utf8");
      child.stderr?.setEncoding("utf8");
      child.stdout?.on("data", (chunk) => {
        if (stdoutBytes + chunk.length > STDOUT_MAX_BYTES3) {
          stdoutCapped = true;
          return;
        }
        stdout += chunk;
        stdoutBytes += chunk.length;
      });
      child.stderr?.on("data", (chunk) => {
        if (stderrBytes + chunk.length > STDERR_MAX_BYTES3) {
          stderrCapped = true;
          return;
        }
        stderr += chunk;
        stderrBytes += chunk.length;
      });
      child.on("error", (err) => {
        clearTimeout(timer);
        reject(new Error(`custom connector '${descriptor.name}' spawn error: ${err.message}`));
      });
      child.on("close", (code, signal) => {
        void (async () => {
          clearTimeout(timer);
          const duration_ms = performance3.now() - start;
          if (timedOut) {
            reject(new Error(`custom connector '${descriptor.name}' timed out after ${timeoutMs2}ms; group-kill ${killGroupSucceeded ? "sent" : "failed"}; final signal=${signal ?? "none"}; stderr[:500]=${stderr.slice(0, 500)}`));
            return;
          }
          if (code !== 0) {
            reject(new Error(`custom connector '${descriptor.name}' exited with code ${code}${signal ? ` (signal ${signal})` : ""}; stderr[:500]=${stderr.slice(0, 500)}`));
            return;
          }
          try {
            const extracted = await extractConfiguredOutput(descriptor, outputFile);
            resolve13({
              request_payload: input.prompt,
              receipt_id: extracted.receiptId,
              result_body: extracted.resultBody,
              duration_ms,
              cli_version: `custom:${descriptor.name}`
            });
          } catch (err) {
            const stdoutSuffix = stdoutCapped ? " [stdout capped]" : "";
            const stderrSuffix = stderrCapped ? " [stderr capped]" : "";
            reject(new Error(`custom connector '${descriptor.name}': ${err.message}; stdout[:500]=${stdout.slice(0, 500)}${stdoutSuffix}; stderr[:200]=${stderr.slice(0, 200)}${stderrSuffix}`));
          }
        })();
      });
    });
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

// dist/shared/selection-resolver.js
var PRE_WORKFLOW_CONFIG_SOURCES = ["default", "user-global", "project"];
function overrideContributes2(o) {
  if (o.model !== void 0)
    return true;
  if (o.effort !== void 0)
    return true;
  if (o.depth !== void 0)
    return true;
  if (o.skills.mode !== "inherit")
    return true;
  if (Object.keys(o.invocation_options).length > 0)
    return true;
  return false;
}
function composeConfigLayerSelection(base, circuit, current) {
  if (base === void 0 && circuit === void 0)
    return void 0;
  const baseSkillOp = base?.skills.mode === "inherit" ? void 0 : base?.skills;
  const circuitSkillOp = circuit?.skills.mode === "inherit" ? void 0 : circuit?.skills;
  let skills;
  if (baseSkillOp !== void 0 || circuitSkillOp !== void 0) {
    const baseSkills = baseSkillOp !== void 0 ? applySkillOp(current.skills, baseSkillOp) : current.skills;
    const composedSkills = circuitSkillOp !== void 0 ? applySkillOp(baseSkills, circuitSkillOp) : baseSkills;
    skills = { mode: "replace", skills: [...composedSkills] };
  }
  const raw = {
    ...base?.model !== void 0 || circuit?.model !== void 0 ? { model: circuit?.model ?? base?.model } : {},
    ...base?.effort !== void 0 || circuit?.effort !== void 0 ? { effort: circuit?.effort ?? base?.effort } : {},
    ...skills !== void 0 ? { skills } : {},
    ...base?.depth !== void 0 || circuit?.depth !== void 0 ? { depth: circuit?.depth ?? base?.depth } : {},
    invocation_options: {
      ...base?.invocation_options ?? {},
      ...circuit?.invocation_options ?? {}
    }
  };
  const parsed = SelectionOverride.parse(raw);
  return overrideContributes2(parsed) ? parsed : void 0;
}
function configLayerSelection(flowId, layer, current) {
  const circuits = layer.config.circuits;
  const circuit = Object.hasOwn(circuits, flowId) ? circuits[flowId] : void 0;
  return composeConfigLayerSelection(layer.config.defaults.selection, circuit?.selection, current);
}
function applySkillOp(base, op) {
  if (op.mode === "inherit")
    return base;
  if (op.mode === "replace")
    return op.skills;
  if (op.mode === "append") {
    const seen = new Set(base);
    const out = [...base];
    for (const s of op.skills) {
      const key = s;
      if (!seen.has(key)) {
        seen.add(key);
        out.push(s);
      }
    }
    return out;
  }
  const removeSet = new Set(op.skills);
  return base.filter((s) => !removeSet.has(s));
}
function applyOverride(current, override) {
  const model = override.model ?? current.model;
  const effort = override.effort ?? current.effort;
  const depth = override.depth ?? current.depth;
  const skills = applySkillOp(current.skills, override.skills);
  const invocation_options = {
    ...current.invocation_options,
    ...override.invocation_options
  };
  return {
    ...model !== void 0 ? { model } : {},
    ...effort !== void 0 ? { effort } : {},
    skills,
    ...depth !== void 0 ? { depth } : {},
    invocation_options
  };
}
function pushIfContributing(applied, entry, resolved) {
  if (!overrideContributes2(entry.override))
    return resolved;
  applied.push(entry);
  return applyOverride(resolved, entry.override);
}
function configLayersBySource(layers) {
  const out = {};
  const seen = /* @__PURE__ */ new Set();
  for (const layer of layers) {
    if (seen.has(layer.layer)) {
      throw new Error(`duplicate selection config layer '${layer.layer}'`);
    }
    seen.add(layer.layer);
    out[layer.layer] = layer;
  }
  return out;
}
function resolveSelectionForRelay(input) {
  const flowId = input.flow.id;
  const stepId = input.step.id;
  const applied = [];
  let resolved = { skills: [], invocation_options: {} };
  const configLayers = configLayersBySource(input.configLayers ?? []);
  for (const source of PRE_WORKFLOW_CONFIG_SOURCES) {
    const layer = configLayers[source];
    if (layer === void 0)
      continue;
    const override = configLayerSelection(flowId, layer, resolved);
    if (override === void 0)
      continue;
    resolved = pushIfContributing(applied, {
      source,
      override
    }, resolved);
  }
  if (input.flow.default_selection !== void 0) {
    resolved = pushIfContributing(applied, { source: "flow", override: input.flow.default_selection }, resolved);
  }
  for (const stage of input.flow.stages) {
    const stageSteps = stage.steps;
    if (!stageSteps.includes(stepId))
      continue;
    if (stage.selection === void 0)
      continue;
    resolved = pushIfContributing(applied, { source: "stage", stage_id: stage.id, override: stage.selection }, resolved);
  }
  if (input.step.selection !== void 0) {
    resolved = pushIfContributing(applied, { source: "step", step_id: input.step.id, override: input.step.selection }, resolved);
  }
  const invocationLayer = configLayers.invocation;
  const invocationOverride = invocationLayer === void 0 ? void 0 : configLayerSelection(flowId, invocationLayer, resolved);
  if (invocationOverride !== void 0) {
    resolved = pushIfContributing(applied, { source: "invocation", override: invocationOverride }, resolved);
  }
  return SelectionResolution.parse({ resolved, applied });
}

// dist/shared/relay-selection.js
function bindsExecutionDepthToRelaySelection(flow) {
  const pkg = findCompiledFlowPackageById(flow.id);
  return pkg?.engineFlags?.bindsExecutionDepthToRelaySelection === true;
}
function selectionConfigLayersWithExecutionDepth(inv, flow, depth) {
  const layers = [...inv.selectionConfigLayers ?? []];
  const flowId = flow.id;
  const existingIndex = layers.findIndex((layer) => layer.layer === "invocation");
  const existing = existingIndex === -1 ? void 0 : layers[existingIndex];
  const baseConfig = existing?.config ?? Config.parse({ schema_version: 1 });
  const existingCircuit = baseConfig.circuits[flowId];
  const selection = {
    ...existingCircuit?.selection ?? {},
    depth
  };
  const invocationLayer = LayeredConfig.parse({
    layer: "invocation",
    ...existing?.source_path === void 0 ? {} : { source_path: existing.source_path },
    config: {
      ...baseConfig,
      circuits: {
        ...baseConfig.circuits,
        [flowId]: {
          ...existingCircuit ?? {},
          selection
        }
      }
    }
  });
  if (existingIndex === -1) {
    layers.push(invocationLayer);
  } else {
    layers[existingIndex] = invocationLayer;
  }
  return layers;
}
function selectionConfigLayersForRelay(inv, flow, depth) {
  if (!bindsExecutionDepthToRelaySelection(flow)) {
    return inv.selectionConfigLayers ?? [];
  }
  return selectionConfigLayersWithExecutionDepth(inv, flow, depth);
}
function deriveResolvedSelection(inv, flow, step, depth) {
  return resolveSelectionForRelay({
    flow,
    step,
    configLayers: selectionConfigLayersForRelay(inv, flow, depth)
  }).resolved;
}

// dist/shared/relay-support.js
import { existsSync as existsSync4, readFileSync as readFileSync12 } from "node:fs";

// dist/flows/registries/shape-hints/registry.js
var SCHEMA_HINTS = buildSchemaHintMap(flowPackages);
var STRUCTURAL_HINTS = buildStructuralHintList(flowPackages);
function findRelayShapeHint(step) {
  const schema = step.writes.report?.schema;
  if (schema !== void 0) {
    const bySchema = SCHEMA_HINTS.get(schema);
    if (bySchema !== void 0)
      return bySchema;
  }
  for (const hint of STRUCTURAL_HINTS) {
    if (hint.match(step))
      return hint.instruction;
  }
  return void 0;
}

// dist/shared/relay-support.js
var NO_VERDICT_SENTINEL = "<no-verdict>";
function evaluateRelayCheck(step, resultBody) {
  let parsed;
  try {
    parsed = JSON.parse(resultBody);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      kind: "fail",
      reason: `relay step '${step.id}': connector result_body did not parse as JSON (${msg})`
    };
  }
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    return {
      kind: "fail",
      reason: `relay step '${step.id}': connector result_body parsed but is not a JSON object (got ${parsed === null ? "null" : Array.isArray(parsed) ? "array" : typeof parsed})`
    };
  }
  const verdictRaw = parsed.verdict;
  if (typeof verdictRaw !== "string" || verdictRaw.length === 0) {
    return {
      kind: "fail",
      reason: `relay step '${step.id}': connector result_body lacks a non-empty string 'verdict' field (got ${typeof verdictRaw === "string" ? "empty string" : typeof verdictRaw})`
    };
  }
  if (!step.check.pass.includes(verdictRaw)) {
    return {
      kind: "fail",
      reason: `relay step '${step.id}': connector declared verdict '${verdictRaw}' which is not in check.pass [${step.check.pass.join(", ")}]`,
      observedVerdict: verdictRaw
    };
  }
  return { kind: "pass", verdict: verdictRaw };
}
var GENERIC_DISPATCH_SHAPE_HINT = 'Respond with a single raw JSON object whose top-level shape is exactly { "verdict": "<one-of-accepted-verdicts>" } (additional fields permitted). Do not wrap the JSON in Markdown code fences. Do not include any prose before or after the JSON object. The runtime parses your response with JSON.parse and rejects the run on any parse failure or on a verdict not drawn from the accepted-verdicts list.';
function relayResponseInstruction(step) {
  return findRelayShapeHint(step) ?? GENERIC_DISPATCH_SHAPE_HINT;
}
function selectedSkillsSection(skills) {
  if (skills.length === 0)
    return void 0;
  return [
    "Selected Skills:",
    "The operator selected these local skills for this step. Treat them as guidance. They do not override Circuit's response contract, accepted verdicts, or required JSON shape.",
    "",
    ...skills.map((skill) => [
      `## Skill: ${skill.id}${skill.slot === void 0 ? "" : ` (slot: ${skill.slot})`}`,
      `Source: ${skill.path}`,
      `SHA-256: ${skill.sha256}`,
      "",
      skill.body
    ].join("\n"))
  ].join("\n\n");
}
function composeRelayPrompt(step, runFolder, loadedSkills = []) {
  const readsBody = step.reads.length === 0 ? "(no reads)" : step.reads.map((path) => {
    const abs = resolveRunRelative(runFolder, path);
    if (!existsSync4(abs))
      return `[reads unavailable: ${path}]`;
    return `--- ${path} ---
${readFileSync12(abs, "utf8")}`;
  }).join("\n\n");
  const skillsSection = selectedSkillsSection(loadedSkills);
  return [
    `Step: ${step.id}`,
    `Title: ${step.title}`,
    `Role: ${step.role}`,
    `Accepted verdicts: ${step.check.pass.join(", ")}`,
    "",
    "Context (from reads):",
    readsBody,
    "",
    ...skillsSection === void 0 ? [] : [skillsSection, ""],
    relayResponseInstruction(step)
  ].join("\n");
}

// dist/shared/user-skill-registry.js
var import_yaml = __toESM(require_dist(), 1);
import { createHash as createHash3 } from "node:crypto";
import { existsSync as existsSync5, readFileSync as readFileSync13, readdirSync } from "node:fs";
import { homedir } from "node:os";
import { join as join3, resolve as resolve5 } from "node:path";
var FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)([\s\S]*)$/;
var UserSkillFrontmatter = UserSkillEntry.pick({
  name: true,
  description: true,
  trigger: true
}).passthrough();
function defaultUserSkillRoots(homeDir = homedir()) {
  return [join3(homeDir, ".agents", "skills"), join3(homeDir, ".claude", "skills")];
}
function sha256Hex2(text) {
  return createHash3("sha256").update(text, "utf8").digest("hex");
}
function parseSkillMarkdown(text, skillPath) {
  if (!text.startsWith("---"))
    return { metadata: {}, body: text };
  const match = FRONTMATTER_RE.exec(text);
  if (match === null) {
    throw new Error(`skill frontmatter parse failed at ${skillPath}: missing closing ---`);
  }
  let rawFrontmatter;
  try {
    rawFrontmatter = (0, import_yaml.parse)(match[1] ?? "");
  } catch (err) {
    throw new Error(`skill frontmatter parse failed at ${skillPath}: ${err.message}`);
  }
  const parsed = UserSkillFrontmatter.safeParse(rawFrontmatter ?? {});
  if (!parsed.success) {
    throw new Error(`skill frontmatter validation failed at ${skillPath}: ${parsed.error.message}`);
  }
  return {
    metadata: {
      ...parsed.data.name === void 0 ? {} : { name: parsed.data.name },
      ...parsed.data.description === void 0 ? {} : { description: parsed.data.description },
      ...parsed.data.trigger === void 0 ? {} : { trigger: parsed.data.trigger }
    },
    body: match[2] ?? ""
  };
}
function discoverCandidates(roots) {
  const candidates = /* @__PURE__ */ new Map();
  for (const root of roots) {
    const rootAbs = resolve5(root);
    if (!existsSync5(rootAbs))
      continue;
    for (const entry of readdirSync(rootAbs, { withFileTypes: true })) {
      if (!entry.isDirectory())
        continue;
      const id = SkillId.safeParse(entry.name);
      if (!id.success)
        continue;
      const key = id.data;
      if (candidates.has(key))
        continue;
      const skillPath = join3(rootAbs, entry.name, "SKILL.md");
      if (!existsSync5(skillPath))
        continue;
      candidates.set(key, {
        id: id.data,
        root: rootAbs,
        path: skillPath
      });
    }
  }
  return candidates;
}
function loadCandidate(candidate) {
  let text;
  try {
    text = readFileSync13(candidate.path, "utf8");
  } catch (err) {
    throw new Error(`selected skill '${candidate.id}' could not be read at ${candidate.path}: ${err.message}`);
  }
  const parsed = parseSkillMarkdown(text, candidate.path);
  const entry = UserSkillEntry.parse({
    id: candidate.id,
    ...parsed.metadata,
    root: candidate.root,
    path: candidate.path,
    sha256: sha256Hex2(text),
    bytes: Buffer.byteLength(text, "utf8")
  });
  return { entry, body: parsed.body };
}
function createUserSkillRegistry(options = {}) {
  const roots = options.roots ?? defaultUserSkillRoots(options.homeDir);
  const candidates = discoverCandidates(roots);
  const searchedRoots = roots.map((root) => resolve5(root));
  return {
    roots: searchedRoots,
    list() {
      return [...candidates.values()].map((candidate) => loadCandidate(candidate).entry);
    },
    resolve(id) {
      const key = id;
      const candidate = candidates.get(key);
      if (candidate === void 0) {
        throw new Error([
          `Circuit could not find skill '${key}'.`,
          "Searched:",
          ...searchedRoots.map((root) => `- ${join3(root, key, "SKILL.md")}`)
        ].join("\n"));
      }
      return loadCandidate(candidate);
    }
  };
}

// dist/shared/skill-loading.js
function resolveSkillBindingsForFlow(flowId, configLayers = []) {
  const globalBindings = /* @__PURE__ */ new Map();
  const flowBindings = /* @__PURE__ */ new Map();
  const flowKey = flowId;
  for (const layer of configLayers) {
    for (const [slot, skill] of Object.entries(layer.config.skills.bindings)) {
      if (skill === void 0)
        continue;
      globalBindings.set(slot, skill);
    }
    const circuit = layer.config.circuits[flowKey];
    if (circuit === void 0)
      continue;
    for (const [slot, skill] of Object.entries(circuit.skill_bindings)) {
      if (skill === void 0)
        continue;
      flowBindings.set(slot, skill);
    }
  }
  return new Map([...globalBindings, ...flowBindings]);
}
function resolveLoadedRelaySkills(input) {
  const registry = input.registry ?? createUserSkillRegistry();
  const bindings = resolveSkillBindingsForFlow(input.flowId, input.configLayers);
  const loaded = [];
  const seen = /* @__PURE__ */ new Set();
  const addSkill = (id, slot) => {
    const key = id;
    if (seen.has(key))
      return;
    let resolved;
    try {
      resolved = registry.resolve(id);
    } catch (err) {
      const slotText = slot === void 0 ? "" : ` for slot '${slot}'`;
      throw new Error(`relay step '${input.stepId}' selected skill '${key}'${slotText} could not be resolved:
${err.message}`);
    }
    seen.add(key);
    loaded.push({
      id: resolved.entry.id,
      ...slot === void 0 ? {} : { slot },
      path: resolved.entry.path,
      sha256: resolved.entry.sha256,
      bytes: resolved.entry.bytes,
      body: resolved.body
    });
  };
  for (const id of input.resolvedSelection.skills) {
    addSkill(id);
  }
  for (const slot of input.skillSlots) {
    const skill = bindings.get(slot.id);
    if (skill === void 0)
      continue;
    addSkill(skill, slot.id);
  }
  return loaded;
}

// dist/runtime/connectors/resolver.js
var CLAUDE_CODE_SUPPORTED_EFFORTS2 = ["low", "medium", "high", "xhigh"];
var CODEX_SUPPORTED_EFFORTS2 = ["low", "medium", "high", "xhigh"];
function mergedRelayConfig(layers) {
  const merged = {
    default: "auto",
    roles: {},
    circuits: {},
    connectors: {}
  };
  for (const layer of layers ?? []) {
    if (layer.config.relay.default !== "auto" || merged.default === "auto") {
      merged.default = layer.config.relay.default;
    }
    merged.roles = { ...merged.roles, ...layer.config.relay.roles };
    merged.circuits = { ...merged.circuits, ...layer.config.relay.circuits };
    merged.connectors = { ...merged.connectors, ...layer.config.relay.connectors };
  }
  return merged;
}
function connectorCapabilities(connector) {
  if (connector.kind === "builtin")
    return BUILTIN_CONNECTOR_CAPABILITIES[connector.name];
  return connector.capabilities;
}
function assertConnectorCanRunRole(connector, role) {
  const capabilities = connectorCapabilities(connector);
  if (role === "implementer" && capabilities.filesystem === "read-only") {
    throw new Error(`relay connector '${connector.name}' is read-only and cannot run implementer step role '${role}'`);
  }
}
function resolvedConnectorFromReference(ref, relay) {
  if (ref.kind === "builtin")
    return ref;
  const descriptor = relay.connectors[ref.name];
  if (descriptor === void 0) {
    throw new Error(`relay connector '${ref.name}' is referenced but not declared`);
  }
  return descriptor;
}
function resolvedConnectorFromDefault(defaultRef, relay) {
  if (defaultRef === "claude-code" || defaultRef === "codex") {
    return { kind: "builtin", name: defaultRef };
  }
  const descriptor = relay.connectors[defaultRef];
  if (descriptor === void 0) {
    throw new Error(`relay default connector '${defaultRef}' is referenced but not declared`);
  }
  return descriptor;
}
function decision(connector, resolvedFrom, role) {
  assertConnectorCanRunRole(connector, role);
  return {
    connectorName: connector.name,
    connector,
    resolvedFrom
  };
}
function resolveConnectorForRelay(input) {
  if (input.explicitConnector !== void 0) {
    return decision(input.explicitConnector, { source: "explicit" }, input.role);
  }
  const relay = mergedRelayConfig(input.configLayers);
  const roleRef = relay.roles[input.role];
  if (roleRef !== void 0) {
    return decision(resolvedConnectorFromReference(roleRef, relay), {
      source: "role",
      role: input.role
    }, input.role);
  }
  const flowId = input.flowId;
  const flowRef = relay.circuits[flowId];
  if (flowRef !== void 0) {
    return decision(resolvedConnectorFromReference(flowRef, relay), {
      source: "circuit",
      flow_id: flowId
    }, input.role);
  }
  if (relay.default !== "auto") {
    return decision(resolvedConnectorFromDefault(relay.default, relay), { source: "default" }, input.role);
  }
  return decision({ kind: "builtin", name: "claude-code" }, { source: "auto" }, input.role);
}
function expectedProvider(connectorName) {
  if (connectorName === "claude-code")
    return "anthropic";
  if (connectorName === "codex")
    return "openai";
  return void 0;
}
function assertConnectorSelectionCompatible(connectorName, selection) {
  const expected = expectedProvider(connectorName);
  const model = selection?.model;
  if (expected !== void 0 && model !== void 0 && model.provider !== expected) {
    throw new Error(`${connectorName} connector cannot honor model provider '${model.provider}' for model '${model.model}'; expected provider '${expected}'`);
  }
  const effort = selection?.effort;
  if (effort === void 0)
    return;
  const supported = connectorName === "claude-code" ? CLAUDE_CODE_SUPPORTED_EFFORTS2 : connectorName === "codex" ? CODEX_SUPPORTED_EFFORTS2 : void 0;
  if (supported !== void 0 && !supported.includes(effort)) {
    throw new Error(`${connectorName} connector cannot honor effort '${effort}'; supported efforts: ${supported.join(", ")}`);
  }
}

// dist/runtime/executors/relay.js
function createStubRelayConnector(response = { ok: true }) {
  return {
    async relay() {
      return response;
    }
  };
}
function builtinConnector(name) {
  if (name === "claude-code" || name === "codex") {
    return { kind: "builtin", name };
  }
  return void 0;
}
function resolvedConnectorName(connector) {
  return connector?.name;
}
function configLayerConnector(name, configLayers) {
  let descriptor;
  for (const layer of configLayers ?? []) {
    descriptor = layer.config.relay.connectors[name] ?? descriptor;
  }
  return descriptor;
}
function requestedConnectorForRelay(input) {
  const suppliedResolved = input.suppliedConnector?.connector;
  const suppliedResolvedName = resolvedConnectorName(suppliedResolved);
  const suppliedName = input.suppliedConnector?.connectorName ?? suppliedResolvedName;
  if (input.suppliedConnector?.connectorName !== void 0 && suppliedResolvedName !== void 0 && input.suppliedConnector.connectorName !== suppliedResolvedName) {
    throw new Error(`relay connector identity mismatch: connectorName '${input.suppliedConnector.connectorName}' does not match resolved connector '${suppliedResolvedName}'`);
  }
  if (input.stepConnector !== void 0 && suppliedName !== void 0 && input.stepConnector !== suppliedName) {
    throw new Error(`relay connector identity mismatch: step requests '${input.stepConnector}' but supplied connector is '${suppliedName}'`);
  }
  const requested = input.stepConnector ?? suppliedName;
  if (requested === void 0)
    return void 0;
  const builtin = builtinConnector(requested);
  if (builtin !== void 0)
    return builtin;
  if (suppliedResolved !== void 0 && suppliedResolved.name === requested) {
    return suppliedResolved;
  }
  const configured = configLayerConnector(requested, input.configLayers);
  if (configured !== void 0)
    return configured;
  throw new Error(`relay connector '${requested}' requires resolved connector capabilities before execution`);
}
function selectionForCompatibility(selection) {
  if (selection === void 0)
    return void 0;
  if (selection === null || typeof selection !== "object" || Array.isArray(selection)) {
    return void 0;
  }
  const selectionRecord = selection;
  return ResolvedSelection.parse({
    ...selectionRecord.model === void 0 ? {} : { model: selectionRecord.model },
    ...selectionRecord.effort === void 0 ? {} : { effort: selectionRecord.effort },
    skills: [],
    invocation_options: {}
  });
}
function resolveRelayExecution(input) {
  const role = RelayRole.parse(input.role);
  const explicitConnector = requestedConnectorForRelay({
    ...input.stepConnector === void 0 ? {} : { stepConnector: input.stepConnector },
    ...input.suppliedConnector === void 0 ? {} : { suppliedConnector: input.suppliedConnector },
    ...input.configLayers === void 0 ? {} : { configLayers: input.configLayers }
  });
  const resolved = resolveConnectorForRelay({
    flowId: input.flowId,
    role,
    ...input.configLayers === void 0 ? {} : { configLayers: input.configLayers },
    ...explicitConnector === void 0 ? {} : { explicitConnector }
  });
  const resolvedConnector = resolved.connector;
  assertConnectorSelectionCompatible(resolvedConnector.name, selectionForCompatibility(input.selection));
  return {
    role,
    connectorName: resolvedConnector.name,
    connector: resolvedConnector,
    resolvedFrom: resolved.resolvedFrom
  };
}
async function relayWithResolvedConnector(connector, input) {
  const relayInput = {
    prompt: input.prompt,
    ...input.timeoutMs === void 0 ? {} : { timeoutMs: input.timeoutMs },
    ...input.resolvedSelection === void 0 ? {} : { resolvedSelection: ResolvedSelection.parse(input.resolvedSelection) }
  };
  if (connector.kind === "builtin" && connector.name === "claude-code") {
    return relayClaudeCode(relayInput);
  }
  if (connector.kind === "builtin" && connector.name === "codex") {
    return relayCodex(relayInput);
  }
  if (connector.kind === "custom") {
    return relayCustom({ ...relayInput, descriptor: connector });
  }
  throw new Error(`unsupported relay connector '${connector.name}'`);
}
function timeoutMs(step) {
  const wallClock = step.budgets?.wall_clock_ms;
  return typeof wallClock === "number" ? wallClock : void 0;
}
function suppliedConnectorFromRelayer(context) {
  if (context.relayer === void 0)
    return void 0;
  return {
    connectorName: context.relayer.connectorName,
    ...context.relayer.connector === void 0 ? {} : { connector: context.relayer.connector },
    async relay() {
      throw new Error("relay identity placeholder should not be invoked");
    }
  };
}
function defaultValidateAcceptedProductionRelay(input) {
  const { compiledFlow, context, step, relayResult, checkEvaluation } = input;
  if (step.report?.schema === void 0)
    return { evaluation: checkEvaluation };
  const parseResult = parseReport(step.report.schema, relayResult.result_body);
  if (parseResult.kind === "fail") {
    return {
      evaluation: {
        kind: "fail",
        reason: `relay step '${step.id}': ${parseResult.reason}`,
        observedVerdict: checkEvaluation.verdict
      }
    };
  }
  const crossResult = runCrossReportValidator(step.report.schema, compiledFlow, context.runDir, relayResult.result_body);
  if (crossResult.kind === "fail") {
    return {
      evaluation: {
        kind: "fail",
        reason: `relay step '${step.id}': ${crossResult.reason}`,
        observedVerdict: checkEvaluation.verdict
      }
    };
  }
  return { evaluation: checkEvaluation };
}
async function executeProductionRelayAttempt(input) {
  const { step, compiledStep, context } = input;
  const compiledFlow = requireCompiledFlow(context, step);
  const suppliedConnector = suppliedConnectorFromRelayer(context);
  const relayExecution = resolveRelayExecution({
    flowId: context.flow.id,
    role: step.role,
    ...suppliedConnector === void 0 ? {} : { suppliedConnector },
    ...context.selectionConfigLayers === void 0 ? {} : { configLayers: context.selectionConfigLayers },
    ...step.selection === void 0 ? {} : { selection: step.selection },
    ...step.connector === void 0 ? {} : { stepConnector: step.connector }
  });
  const resolvedSelection = deriveResolvedSelection({
    ...context.relayer === void 0 ? {} : { relayer: context.relayer },
    ...context.selectionConfigLayers === void 0 ? {} : { selectionConfigLayers: context.selectionConfigLayers }
  }, compiledFlow, compiledStep, Depth.parse(context.depth ?? "standard"));
  assertConnectorSelectionCompatible(relayExecution.connectorName, resolvedSelection);
  const loadedSkills = resolveLoadedRelaySkills({
    flowId: compiledFlow.id,
    stepId: step.id,
    skillSlots: compiledStep.skill_slots ?? [],
    resolvedSelection,
    ...context.selectionConfigLayers === void 0 ? {} : { configLayers: context.selectionConfigLayers }
  });
  const prompt = composeRelayPrompt(compiledStep, context.runDir, loadedSkills);
  const request = step.writes?.request;
  const receipt = step.writes?.receipt;
  const result = step.writes?.result;
  if (request === void 0 || receipt === void 0 || result === void 0) {
    throw new Error(`relay step '${step.id}' requires writes.request, writes.receipt, and writes.result`);
  }
  const requestPath = context.files.resolve(request);
  await mkdir2(dirname(requestPath), { recursive: true });
  await writeFile2(requestPath, prompt, "utf8");
  const requestPayloadHash = sha256Hex(prompt);
  const startMs = Date.now();
  const attempt = context.activeStepAttempt ?? 1;
  await context.trace.append({
    run_id: context.runId,
    kind: "relay.started",
    step_id: step.id,
    attempt,
    connector: relayExecution.connector,
    role: RelayRole.parse(relayExecution.role),
    resolved_selection: resolvedSelection,
    resolved_from: relayExecution.resolvedFrom
  });
  if (loadedSkills.length > 0) {
    await context.trace.append({
      run_id: context.runId,
      kind: "skills.loaded",
      step_id: step.id,
      attempt,
      skills: loadedSkills.map(({ body: _body, ...skill }) => skill)
    });
  }
  await context.trace.append({
    run_id: context.runId,
    kind: "relay.request",
    step_id: step.id,
    attempt,
    request_payload_hash: requestPayloadHash
  });
  let relayResult;
  try {
    const relayTimeoutMs = timeoutMs(step);
    relayResult = context.relayer === void 0 ? await relayWithResolvedConnector(relayExecution.connector, {
      prompt,
      ...relayTimeoutMs === void 0 ? {} : { timeoutMs: relayTimeoutMs },
      resolvedSelection
    }) : await context.relayer.relay({
      prompt,
      ...relayTimeoutMs === void 0 ? {} : { timeoutMs: relayTimeoutMs },
      resolvedSelection
    });
  } catch (error) {
    const reason = (input.formatConnectorFailureReason ?? ((stepId, caught) => `relay step '${stepId}': connector invocation failed (${caught.message})`))(step.id, error);
    await context.trace.append({
      run_id: context.runId,
      kind: "relay.failed",
      step_id: step.id,
      attempt,
      connector: relayExecution.connector,
      role: RelayRole.parse(relayExecution.role),
      resolved_selection: resolvedSelection,
      resolved_from: relayExecution.resolvedFrom,
      request_payload_hash: requestPayloadHash,
      reason
    });
    return { kind: "connector_failed", reason, duration_ms: Math.max(0, Date.now() - startMs) };
  }
  await context.files.writeText(receipt, relayResult.receipt_id);
  await context.files.writeText(result, relayResult.result_body);
  await context.trace.append({
    run_id: context.runId,
    kind: "relay.receipt",
    step_id: step.id,
    attempt,
    cli_version: relayResult.cli_version,
    receipt_id: relayResult.receipt_id
  });
  await context.trace.append({
    run_id: context.runId,
    kind: "relay.result",
    step_id: step.id,
    attempt,
    result_report_hash: sha256Hex(relayResult.result_body)
  });
  const checkEvaluation = evaluateRelayCheck(compiledStep, relayResult.result_body);
  let evaluation = checkEvaluation;
  let parsedBody;
  if (checkEvaluation.kind === "pass") {
    const validation = (input.validateAcceptedResult ?? defaultValidateAcceptedProductionRelay)({
      compiledFlow,
      context,
      step,
      compiledStep,
      relayResult,
      checkEvaluation
    });
    evaluation = validation.evaluation;
    parsedBody = validation.parsedBody;
  }
  const relayCompletedVerdict = evaluation.kind === "pass" ? evaluation.verdict : evaluation.observedVerdict ?? NO_VERDICT_SENTINEL;
  const durationMs = Math.max(0, Date.now() - startMs);
  let writtenReportPath;
  if (step.report !== void 0) {
    let reportBody;
    if (checkEvaluation.kind === "pass" && evaluation.kind === "pass") {
      reportBody = parsedBody;
      if (reportBody === void 0) {
        try {
          reportBody = JSON.parse(relayResult.result_body);
        } catch {
          reportBody = void 0;
        }
      }
    } else if (checkEvaluation.kind === "fail" && step.report.schema !== void 0) {
      const parseResult = parseReport(step.report.schema, relayResult.result_body);
      if (parseResult.kind === "ok") {
        try {
          reportBody = JSON.parse(relayResult.result_body);
        } catch {
          reportBody = void 0;
        }
      }
    }
    if (reportBody !== void 0) {
      await context.files.writeJson(step.report, reportBody);
      parsedBody = reportBody;
      writtenReportPath = step.report.path;
    }
  }
  await context.trace.append({
    run_id: context.runId,
    kind: "relay.completed",
    step_id: step.id,
    attempt,
    verdict: relayCompletedVerdict,
    duration_ms: durationMs,
    result_path: result.path,
    receipt_path: receipt.path
  });
  await context.trace.append({
    run_id: context.runId,
    kind: "check.evaluated",
    step_id: step.id,
    attempt,
    check_kind: "result_verdict",
    outcome: evaluation.kind === "pass" ? "pass" : "fail",
    ...evaluation.kind === "pass" ? {} : { reason: evaluation.reason }
  });
  return {
    kind: "completed",
    evaluation,
    relay_completed_verdict: relayCompletedVerdict,
    duration_ms: durationMs,
    result_path: result.path,
    ...parsedBody === void 0 ? {} : { parsed_body: parsedBody },
    ...writtenReportPath === void 0 ? {} : { report_path: writtenReportPath }
  };
}
async function executeRelay(step, context, connector) {
  if (connector === void 0 && context.compiledFlow !== void 0) {
    return executeProductionRelay(step, context);
  }
  const suppliedConnector = connector ?? createStubRelayConnector();
  const relayExecution = resolveRelayExecution({
    flowId: context.flow.id,
    role: step.role,
    suppliedConnector,
    ...context.selectionConfigLayers === void 0 ? {} : { configLayers: context.selectionConfigLayers },
    ...step.selection === void 0 ? {} : { selection: step.selection },
    ...step.connector === void 0 ? {} : { stepConnector: step.connector }
  });
  const request = {
    runId: context.runId,
    stepId: step.id,
    role: relayExecution.role,
    prompt: step.prompt ?? "",
    connector: relayExecution.connectorName
  };
  const response = await suppliedConnector.relay(request);
  const writes = step.writes ?? {};
  await Promise.all(Object.values(writes).map((ref) => context.files.writeJson(ref, {
    stepId: step.id,
    role: step.role,
    response
  })));
  return { route: "pass", details: { role: step.role } };
}
async function executeProductionRelay(step, context) {
  const compiledStep = requireCompiledStep(context, step, "relay");
  const relayAttempt = await executeProductionRelayAttempt({ step, context, compiledStep });
  if (relayAttempt.kind === "connector_failed") {
    const recoveryRoute2 = recoveryRouteForExecutableStep(step);
    if (recoveryRoute2 !== void 0)
      return { route: recoveryRoute2, details: { reason: relayAttempt.reason } };
    throw new Error(relayAttempt.reason);
  }
  const { evaluation } = relayAttempt;
  if (evaluation.kind === "pass")
    return { route: "pass", details: { verdict: evaluation.verdict } };
  const recoveryRoute = recoveryRouteForExecutableStep(step);
  if (recoveryRoute !== void 0)
    return { route: recoveryRoute, details: { reason: evaluation.reason } };
  throw new Error(evaluation.reason);
}

// dist/runtime/fanout/branch-execution.js
function admitList(step) {
  const admit = step.check.verdicts?.admit;
  return Array.isArray(admit) ? admit.filter((entry) => typeof entry === "string") : [];
}
function branchResult(body, admit) {
  if (body === null || typeof body !== "object" || Array.isArray(body)) {
    return { verdict: NO_VERDICT_SENTINEL, admitted: false };
  }
  const verdict = body.verdict;
  if (typeof verdict !== "string" || verdict.length === 0) {
    return { verdict: NO_VERDICT_SENTINEL, admitted: false };
  }
  return { verdict, admitted: admit.includes(verdict) };
}
function parseConnectorResponse(response) {
  if (typeof response !== "string")
    return response;
  return JSON.parse(response);
}
function relayBranchProvenanceFailure(branch, reportBody) {
  const field = branch.provenance_field;
  if (field === void 0)
    return void 0;
  if (reportBody === null || typeof reportBody !== "object" || Array.isArray(reportBody)) {
    return `relay fanout branch '${branch.branch_id}': report field '${field}' must equal branch_id '${branch.branch_id}' but report body is not an object`;
  }
  const observed = reportBody[field];
  if (observed !== branch.branch_id) {
    return `relay fanout branch '${branch.branch_id}': report field '${field}' must equal branch_id '${branch.branch_id}'`;
  }
  return void 0;
}
function relayBranchReads(step) {
  return (step.reads ?? []).map((ref) => ref.path);
}
function syntheticRelayTitle(step, branch) {
  return `${step.title ?? step.id} / ${branch.branch_id}: ${branch.goal}`;
}
function syntheticRelayStep(step, branch, branchDirRel) {
  const selection = branch.selection === void 0 || branch.selection === null ? {} : { selection: branch.selection };
  return {
    id: `${step.id}-${branch.branch_id}`,
    title: syntheticRelayTitle(step, branch),
    ...step.protocol === void 0 ? {} : { protocol: step.protocol },
    routes: { pass: { kind: "terminal", target: "@complete" } },
    ...step.reads === void 0 ? {} : { reads: step.reads },
    writes: {
      request: { path: `${branchDirRel}/request.txt` },
      receipt: { path: `${branchDirRel}/receipt.txt` },
      result: { path: `${branchDirRel}/result.json` },
      report: { path: `${branchDirRel}/report.json`, schema: branch.report_schema }
    },
    ...selection,
    check: {
      kind: "result_verdict",
      source: { kind: "relay_result", ref: "result" },
      pass: admitList(step)
    },
    kind: "relay",
    role: branch.role,
    report: { path: `${branchDirRel}/report.json`, schema: branch.report_schema }
  };
}
function syntheticCompiledRelayStepV1(step, branch, branchDirRel) {
  return {
    id: `${step.id}-${branch.branch_id}`,
    title: syntheticRelayTitle(step, branch),
    protocol: step.protocol ?? `${step.id}@v1`,
    reads: relayBranchReads(step),
    routes: { pass: "@complete" },
    ...branch.selection === void 0 ? {} : { selection: branch.selection },
    skill_slots: [],
    executor: "worker",
    kind: "relay",
    role: branch.role,
    writes: {
      request: `${branchDirRel}/request.txt`,
      receipt: `${branchDirRel}/receipt.txt`,
      result: `${branchDirRel}/result.json`,
      report: {
        path: `${branchDirRel}/report.json`,
        schema: branch.report_schema
      }
    },
    check: {
      kind: "result_verdict",
      source: { kind: "relay_result", ref: "result" },
      pass: [...admitList(step)]
    }
  };
}
function validateAcceptedRelayFanoutBranch(branch, input) {
  const parseResult = parseReport(branch.report_schema, input.relayResult.result_body);
  if (parseResult.kind === "fail") {
    return {
      evaluation: {
        kind: "fail",
        reason: `relay fanout branch '${branch.branch_id}': ${parseResult.reason}`,
        observedVerdict: input.checkEvaluation.verdict
      }
    };
  }
  const parsedBody = JSON.parse(input.relayResult.result_body);
  const provenanceFailure = relayBranchProvenanceFailure(branch, parsedBody);
  if (provenanceFailure !== void 0) {
    return {
      evaluation: {
        kind: "fail",
        reason: provenanceFailure,
        observedVerdict: input.checkEvaluation.verdict
      }
    };
  }
  const crossResult = runCrossReportValidator(branch.report_schema, input.compiledFlow, input.context.runDir, input.relayResult.result_body);
  if (crossResult.kind === "fail") {
    return {
      evaluation: {
        kind: "fail",
        reason: `relay fanout branch '${branch.branch_id}': ${crossResult.reason}`,
        observedVerdict: input.checkEvaluation.verdict
      }
    };
  }
  return { evaluation: input.checkEvaluation, parsedBody };
}
async function executeRelayFanoutBranch(step, context, branch, relayConnector, branchDirRel, branchDirAbs) {
  const startMs = Date.now();
  const attempt = context.activeStepAttempt ?? 1;
  const childRunId = randomUUID();
  const resultPath2 = `${branchDirRel}/result.json`;
  const reportPath = `${branchDirRel}/report.json`;
  await context.trace.append({
    run_id: context.runId,
    kind: "fanout.branch_started",
    step_id: step.id,
    attempt,
    branch_id: branch.branch_id,
    branch_kind: "relay",
    child_run_id: childRunId,
    worktree_path: branchDirAbs
  });
  try {
    if (relayConnector === void 0 && context.compiledFlow !== void 0) {
      const relayStep = syntheticRelayStep(step, branch, branchDirRel);
      const relayAttempt = await executeProductionRelayAttempt({
        step: relayStep,
        compiledStep: syntheticCompiledRelayStepV1(step, branch, branchDirRel),
        context,
        formatConnectorFailureReason: (_stepId, error) => {
          const reason = error instanceof Error ? error.message : String(error);
          return `relay fanout branch '${branch.branch_id}': connector invocation failed (${reason})`;
        },
        validateAcceptedResult: (input) => validateAcceptedRelayFanoutBranch(branch, input)
      });
      const durationMs2 = Math.max(0, Date.now() - startMs);
      const outcome = relayAttempt.kind === "connector_failed" ? {
        child_outcome: "aborted",
        verdict: NO_VERDICT_SENTINEL,
        result_path: resultPath2,
        admitted: false,
        failure_reason: relayAttempt.reason
      } : relayAttempt.evaluation.kind === "pass" ? {
        child_outcome: "complete",
        verdict: relayAttempt.evaluation.verdict,
        result_path: relayAttempt.report_path ?? reportPath,
        result_body: relayAttempt.parsed_body,
        admitted: true
      } : {
        child_outcome: "aborted",
        verdict: relayAttempt.relay_completed_verdict,
        result_path: resultPath2,
        admitted: false,
        failure_reason: relayAttempt.evaluation.reason
      };
      await context.trace.append({
        run_id: context.runId,
        kind: "fanout.branch_completed",
        step_id: step.id,
        attempt,
        branch_id: branch.branch_id,
        branch_kind: "relay",
        child_run_id: childRunId,
        child_outcome: outcome.child_outcome,
        verdict: outcome.verdict,
        duration_ms: durationMs2,
        result_path: outcome.result_path
      });
      return {
        branch_id: branch.branch_id,
        child_run_id: childRunId,
        worktree_path: branchDirAbs,
        duration_ms: durationMs2,
        ...outcome
      };
    }
    const requestPath = context.files.resolve(`${branchDirRel}/request.json`);
    await mkdir3(dirname2(requestPath), { recursive: true });
    await writeFile3(requestPath, `${JSON.stringify({ branch_id: branch.branch_id, goal: branch.goal }, null, 2)}
`, "utf8");
    const relayExecution = resolveRelayExecution({
      flowId: context.flow.id,
      role: branch.role,
      selection: branch.selection,
      ...relayConnector === void 0 ? {} : { suppliedConnector: relayConnector },
      ...context.selectionConfigLayers === void 0 ? {} : { configLayers: context.selectionConfigLayers }
    });
    const response = relayConnector === void 0 ? (await relayWithResolvedConnector(relayExecution.connector, {
      prompt: branch.goal
    })).result_body : await relayConnector.relay({
      runId: context.runId,
      stepId: `${step.id}-${branch.branch_id}`,
      role: relayExecution.role,
      prompt: branch.goal,
      connector: relayExecution.connectorName
    });
    const reportBody = parseConnectorResponse(response);
    const provenanceFailure = relayBranchProvenanceFailure(branch, reportBody);
    const evaluation = branchResult(reportBody, admitList(step));
    const admitted = provenanceFailure === void 0 && evaluation.admitted;
    await context.files.writeJson(resultPath2, reportBody);
    await context.files.writeJson({ path: reportPath, schema: branch.report_schema }, reportBody);
    const receiptPath = context.files.resolve(`${branchDirRel}/receipt.txt`);
    await mkdir3(dirname2(receiptPath), { recursive: true });
    await writeFile3(receiptPath, `stub relay receipt for ${branch.branch_id}
`, "utf8");
    const durationMs = Math.max(0, Date.now() - startMs);
    await context.trace.append({
      run_id: context.runId,
      kind: "fanout.branch_completed",
      step_id: step.id,
      attempt,
      branch_id: branch.branch_id,
      branch_kind: "relay",
      child_run_id: childRunId,
      child_outcome: admitted ? "complete" : "aborted",
      verdict: evaluation.verdict,
      duration_ms: durationMs,
      result_path: reportPath
    });
    return {
      branch_id: branch.branch_id,
      child_run_id: childRunId,
      worktree_path: branchDirAbs,
      child_outcome: admitted ? "complete" : "aborted",
      verdict: evaluation.verdict,
      result_path: reportPath,
      result_body: reportBody,
      duration_ms: durationMs,
      admitted,
      ...provenanceFailure === void 0 ? {} : { failure_reason: provenanceFailure }
    };
  } catch (error) {
    const durationMs = Math.max(0, Date.now() - startMs);
    await context.trace.append({
      run_id: context.runId,
      kind: "fanout.branch_completed",
      step_id: step.id,
      attempt,
      branch_id: branch.branch_id,
      branch_kind: "relay",
      child_run_id: childRunId,
      child_outcome: "aborted",
      verdict: NO_VERDICT_SENTINEL,
      duration_ms: durationMs,
      result_path: resultPath2
    });
    return {
      branch_id: branch.branch_id,
      child_run_id: childRunId,
      worktree_path: branchDirAbs,
      child_outcome: "aborted",
      verdict: NO_VERDICT_SENTINEL,
      result_path: resultPath2,
      duration_ms: durationMs,
      admitted: false,
      failure_reason: error.message
    };
  }
}
async function executeSubRunFanoutBranch(step, context, branch, worktreeRunner, branchDirRel, worktreePath) {
  const startMs = Date.now();
  const attempt = context.activeStepAttempt ?? 1;
  const childRunId = randomUUID();
  const resultPath2 = `${branchDirRel}/result.json`;
  await context.trace.append({
    run_id: context.runId,
    kind: "fanout.branch_started",
    step_id: step.id,
    attempt,
    branch_id: branch.branch_id,
    branch_kind: "sub-run",
    child_run_id: childRunId,
    worktree_path: worktreePath
  });
  if (context.childCompiledFlowResolver === void 0 || context.childRunner === void 0) {
    const failureReason = `fanout step '${step.id}': child resolver and child runner are required for sub-run branches`;
    const durationMs = Math.max(0, Date.now() - startMs);
    await context.trace.append({
      run_id: context.runId,
      kind: "fanout.branch_completed",
      step_id: step.id,
      attempt,
      branch_id: branch.branch_id,
      branch_kind: "sub-run",
      child_run_id: childRunId,
      child_outcome: "aborted",
      verdict: NO_VERDICT_SENTINEL,
      duration_ms: durationMs,
      result_path: resultPath2
    });
    return {
      branch_id: branch.branch_id,
      child_run_id: childRunId,
      worktree_path: worktreePath,
      child_outcome: "aborted",
      verdict: NO_VERDICT_SENTINEL,
      result_path: resultPath2,
      duration_ms: durationMs,
      admitted: false,
      failure_reason: failureReason
    };
  }
  try {
    const branchName = `circuit-next/${context.runId}/${step.id}/${branch.branch_id}`;
    await Promise.resolve(worktreeRunner.add({ worktreePath, baseRef: "HEAD", branchName }));
    const resolved = await context.childCompiledFlowResolver({
      flowId: branch.flowRef,
      entryMode: branch.entryMode,
      ...branch.version === void 0 ? {} : { version: branch.version }
    });
    const childFlow = CompiledFlow.parse(JSON.parse(Buffer.from(resolved.flowBytes).toString("utf8")));
    if (childFlow.id !== branch.flowRef) {
      throw new Error(`resolver returned flow id '${childFlow.id}' but branch flow_ref names '${branch.flowRef}'`);
    }
    const childRunDir = join4(dirname2(context.runDir), childRunId);
    const child = await context.childRunner({
      flowBytes: resolved.flowBytes,
      runDir: childRunDir,
      runId: childRunId,
      goal: branch.goal,
      entryModeName: branch.entryMode,
      depth: branch.depth,
      now: context.now,
      ...context.childExecutors === void 0 ? {} : { executors: context.childExecutors },
      ...context.childCompiledFlowResolver === void 0 ? {} : { childCompiledFlowResolver: context.childCompiledFlowResolver },
      childRunner: context.childRunner,
      projectRoot: worktreePath,
      ...context.evidencePolicy === void 0 ? {} : { evidencePolicy: context.evidencePolicy },
      worktreeRunner,
      ...context.relayConnector === void 0 ? {} : { relayConnector: context.relayConnector },
      ...context.relayer === void 0 ? {} : { relayer: context.relayer },
      ...context.selectionConfigLayers === void 0 ? {} : { selectionConfigLayers: context.selectionConfigLayers },
      ...context.progress === void 0 ? {} : { progress: context.progress }
    });
    const childResultText = await readFile3(child.resultPath, "utf8");
    const childResult = RunResult.parse(JSON.parse(childResultText));
    await context.files.writeJson(resultPath2, childResult);
    const evaluation = branchResult(childResult, admitList(step));
    const admitted = childResult.outcome === "complete" && evaluation.admitted;
    const durationMs = Math.max(0, Date.now() - startMs);
    await context.trace.append({
      run_id: context.runId,
      kind: "fanout.branch_completed",
      step_id: step.id,
      attempt,
      branch_id: branch.branch_id,
      branch_kind: "sub-run",
      child_run_id: childRunId,
      child_outcome: childResult.outcome,
      verdict: evaluation.verdict,
      duration_ms: durationMs,
      result_path: resultPath2
    });
    return {
      branch_id: branch.branch_id,
      child_run_id: childRunId,
      worktree_path: worktreePath,
      child_outcome: childResult.outcome,
      verdict: evaluation.verdict,
      result_path: resultPath2,
      result_body: childResult,
      duration_ms: durationMs,
      admitted
    };
  } catch (error) {
    const durationMs = Math.max(0, Date.now() - startMs);
    await context.trace.append({
      run_id: context.runId,
      kind: "fanout.branch_completed",
      step_id: step.id,
      attempt,
      branch_id: branch.branch_id,
      branch_kind: "sub-run",
      child_run_id: childRunId,
      child_outcome: "aborted",
      verdict: NO_VERDICT_SENTINEL,
      duration_ms: durationMs,
      result_path: resultPath2
    });
    return {
      branch_id: branch.branch_id,
      child_run_id: childRunId,
      worktree_path: worktreePath,
      child_outcome: "aborted",
      verdict: NO_VERDICT_SENTINEL,
      result_path: resultPath2,
      duration_ms: durationMs,
      admitted: false,
      failure_reason: error.message
    };
  }
}
function branchNeedsWorktree(branch) {
  return branch.kind === "sub-run";
}

// dist/shared/fanout-branch-template.js
function resolveDottedPath(root, path) {
  let cursor = root;
  for (const segment of path.split(".")) {
    if (cursor === null || typeof cursor !== "object" || Array.isArray(cursor)) {
      throw new Error(`items_path '${path}' descended into a non-object at segment '${segment}'`);
    }
    cursor = cursor[segment];
    if (cursor === void 0) {
      throw new Error(`items_path '${path}' is missing at segment '${segment}'`);
    }
  }
  return cursor;
}
function substituteItemPlaceholders(template, item) {
  if (template === "$item")
    return typeof item === "string" ? item : JSON.stringify(item);
  const exactMatch = /^\$item\.([a-z_][a-z0-9_]*)$/i.exec(template);
  if (exactMatch !== null) {
    const key = exactMatch[1];
    if (item === null || typeof item !== "object" || Array.isArray(item)) {
      throw new Error(`'$item.${key}' substitution requires an object item`);
    }
    const value = item[key];
    if (value === void 0) {
      throw new Error(`'$item.${key}' substitution is missing the '${key}' field on the item`);
    }
    return typeof value === "string" ? value : String(value);
  }
  return template.replace(/\$item\.([a-z_][a-z0-9_]*)/gi, (_match, key) => {
    if (item === null || typeof item !== "object" || Array.isArray(item)) {
      throw new Error(`'$item.${key}' substitution requires an object item`);
    }
    const value = item[key];
    if (value === void 0) {
      throw new Error(`'$item.${key}' substitution is missing the '${key}' field on the item`);
    }
    return typeof value === "string" ? value : String(value);
  });
}
function expandTemplate(template, item) {
  if (typeof template === "string") {
    return substituteItemPlaceholders(template, item);
  }
  if (template === null || typeof template !== "object")
    return template;
  if (Array.isArray(template)) {
    return template.map((entry) => expandTemplate(entry, item));
  }
  const out = {};
  for (const [key, value] of Object.entries(template)) {
    out[key] = expandTemplate(value, item);
  }
  return out;
}

// dist/runtime/fanout/branch-expansion.js
function resolveBranch(branch) {
  if ("flow_ref" in branch) {
    return {
      kind: "sub-run",
      branch_id: branch.branch_id,
      flowRef: branch.flow_ref.flow_id,
      entryMode: branch.flow_ref.entry_mode,
      ...branch.flow_ref.version === void 0 ? {} : { version: branch.flow_ref.version },
      goal: branch.goal,
      depth: branch.depth,
      ...branch.selection === void 0 ? {} : { selection: branch.selection }
    };
  }
  return {
    kind: "relay",
    branch_id: branch.branch_id,
    role: branch.execution.role,
    goal: branch.execution.goal,
    report_schema: branch.execution.report_schema,
    ...branch.execution.provenance_field === void 0 ? {} : { provenance_field: branch.execution.provenance_field },
    ...branch.selection === void 0 ? {} : { selection: branch.selection }
  };
}
async function expandFanoutBranches(step, files) {
  const branches = step.branches;
  if (branches.kind === "static") {
    return branches.branches.map((branch) => resolveBranch(FanoutBranch.parse(branch)));
  }
  const sourceRaw = await files.readJson(branches.source_report);
  const items = resolveDottedPath(sourceRaw, branches.items_path);
  if (!Array.isArray(items)) {
    throw new Error(`dynamic fanout: items_path '${branches.items_path}' did not resolve to an array (got ${typeof items})`);
  }
  if (items.length > branches.max_branches) {
    throw new Error(`dynamic fanout expanded to ${items.length} items but max_branches is ${branches.max_branches}`);
  }
  const seen = /* @__PURE__ */ new Set();
  const resolved = [];
  for (const item of items) {
    const branch = FanoutBranch.parse(expandTemplate(branches.template, item));
    if (seen.has(branch.branch_id)) {
      throw new Error(`dynamic fanout produced duplicate branch_id '${branch.branch_id}'`);
    }
    seen.add(branch.branch_id);
    resolved.push(resolveBranch(branch));
  }
  return resolved;
}

// dist/runtime/fanout/worktree.js
import { spawnSync as spawnSync2 } from "node:child_process";
var gitWorktreeRunner = {
  add({ worktreePath, baseRef, branchName }) {
    const result = spawnSync2("git", ["worktree", "add", "-b", branchName, worktreePath, baseRef], {
      encoding: "utf8"
    });
    if (result.status !== 0) {
      throw new Error(`git worktree add failed (exit ${result.status ?? "null"}): ${result.stderr ?? ""}`.trim());
    }
  },
  remove(worktreePath) {
    const result = spawnSync2("git", ["worktree", "remove", "--force", worktreePath], {
      encoding: "utf8"
    });
    if (result.status !== 0) {
      throw new Error(`git worktree remove failed (exit ${result.status ?? "null"}): ${result.stderr ?? ""}`.trim());
    }
  },
  changedFiles(worktreePath, baseRef) {
    const result = spawnSync2("git", ["diff", "--name-only", `${baseRef}..HEAD`], {
      cwd: worktreePath,
      encoding: "utf8"
    });
    if (result.status !== 0) {
      throw new Error(`git diff --name-only failed (exit ${result.status ?? "null"}): ${result.stderr ?? ""}`.trim());
    }
    return (result.stdout ?? "").split("\n").filter((line) => line.length > 0);
  }
};

// dist/runtime/executors/fanout.js
function aggregateRef(step) {
  const aggregate = step.writes?.aggregate;
  if (aggregate !== void 0)
    return aggregate;
  const joinAggregate = step.join.aggregate;
  if (joinAggregate !== void 0)
    return joinAggregate;
  throw new Error(`fanout step '${step.id}' is missing writes.aggregate`);
}
function branchesDir(step) {
  const branchesDirRef = step.writes?.branches_dir;
  if (branchesDirRef !== void 0)
    return branchesDirRef.path;
  throw new Error(`fanout step '${step.id}' is missing writes.branches_dir`);
}
function joinPolicy(step) {
  const policy2 = step.check.join?.policy;
  if (policy2 === "pick-winner" || policy2 === "disjoint-merge" || policy2 === "aggregate-only") {
    return policy2;
  }
  throw new Error(`fanout step '${step.id}' has unsupported join policy`);
}
function admitOrder(step) {
  const admit = step.check.verdicts?.admit;
  return Array.isArray(admit) ? admit.filter((entry) => typeof entry === "string") : [];
}
function concurrencyLimit(step) {
  const concurrency = step.concurrency;
  if (concurrency?.kind === "unbounded")
    return "unbounded";
  if (concurrency?.kind === "bounded" && typeof concurrency.max === "number") {
    return concurrency.max;
  }
  return 4;
}
async function runWithConcurrency(items, limit, worker) {
  const abortSignal = { value: false };
  if (limit === "unbounded") {
    await Promise.all(items.map((item) => worker(item, abortSignal)));
    return;
  }
  let cursor = 0;
  const workers = [];
  for (let i = 0; i < Math.min(limit, items.length); i += 1) {
    workers.push((async () => {
      while (!abortSignal.value) {
        const index = cursor;
        cursor += 1;
        const item = items[index];
        if (item === void 0)
          return;
        await worker(item, abortSignal);
      }
    })());
  }
  await Promise.all(workers);
}
async function executeFanout(step, context, relayConnector) {
  const attempt = context.activeStepAttempt ?? 1;
  const branchDirRoot = branchesDir(step);
  const aggregate = aggregateRef(step);
  const branches = await expandFanoutBranches(step, context.files);
  if (branches.length === 0) {
    throw new Error(`fanout step '${step.id}': branch resolution produced zero branches`);
  }
  const policy2 = joinPolicy(step);
  if (policy2 === "disjoint-merge" && branches.some((branch) => branch.kind !== "sub-run")) {
    throw new Error(`fanout step '${step.id}': disjoint-merge is only supported for sub-run branches with worktrees`);
  }
  const branchIds = branches.map((branch) => branch.branch_id);
  await context.trace.append({
    run_id: context.runId,
    kind: "fanout.started",
    step_id: step.id,
    attempt,
    branch_ids: branchIds,
    on_child_failure: FanoutFailurePolicy.parse(step.onChildFailure ?? "abort-all")
  });
  const worktreeRunner = context.worktreeRunner ?? gitWorktreeRunner;
  const provisioned = [];
  const outcomes = [];
  const onChildFailure = step.onChildFailure ?? "abort-all";
  let branchFiles;
  let branchFilesError;
  try {
    await runWithConcurrency(branches, concurrencyLimit(step), async (branch, abortSignal) => {
      if (abortSignal.value)
        return;
      const branchDirRel = `${branchDirRoot}/${branch.branch_id}`;
      const branchDirAbs = context.files.resolve(branchDirRel);
      let outcome;
      if (branch.kind === "relay") {
        outcome = await executeRelayFanoutBranch(step, context, branch, relayConnector, branchDirRel, branchDirAbs);
      } else {
        if (context.projectRoot === void 0) {
          throw new Error(`fanout step '${step.id}': projectRoot is required to anchor per-branch worktrees`);
        }
        const worktreePath = joinPath(context.projectRoot, ".circuit-next", "worktrees", context.runId, step.id, branch.branch_id);
        if (branchNeedsWorktree(branch))
          provisioned.push(worktreePath);
        outcome = await executeSubRunFanoutBranch(step, context, branch, worktreeRunner, branchDirRel, worktreePath);
      }
      outcomes.push(outcome);
      if (!outcome.admitted && onChildFailure === "abort-all") {
        abortSignal.value = true;
      }
    });
    if (policy2 === "disjoint-merge" && outcomes.every((outcome) => outcome.admitted)) {
      try {
        const collected = await Promise.all(outcomes.map(async (outcome) => {
          const files = worktreeRunner.changedFiles ? await Promise.resolve(worktreeRunner.changedFiles(outcome.worktree_path, "HEAD")) : [];
          return [outcome.branch_id, files];
        }));
        branchFiles = new Map(collected);
      } catch (error) {
        branchFilesError = error.message;
      }
    }
  } finally {
    for (const worktreePath of provisioned) {
      try {
        await Promise.resolve(worktreeRunner.remove(worktreePath));
      } catch {
      }
    }
  }
  const joinResult = evaluateFanoutJoinPolicy({
    policy: policy2,
    stepId: step.id,
    admitOrder: admitOrder(step),
    outcomes: outcomes.map((outcome) => ({
      branch_id: outcome.branch_id,
      child_outcome: outcome.child_outcome,
      verdict: outcome.verdict,
      admitted: outcome.admitted,
      ...outcome.result_body === void 0 ? {} : { result_body: outcome.result_body },
      ...outcome.failure_reason === void 0 ? {} : { failure_reason: outcome.failure_reason }
    })),
    ...branchFiles === void 0 ? {} : { branchFiles },
    ...branchFilesError === void 0 ? {} : { branchFilesError }
  });
  await context.files.writeJson(aggregate, buildFanoutAggregate(policy2, outcomes, joinResult.winnerBranchId));
  await context.trace.append({
    run_id: context.runId,
    kind: "step.report_written",
    step_id: step.id,
    attempt,
    report_path: aggregate.path,
    report_schema: aggregate.schema ?? "fanout-aggregate@v1"
  });
  const branchesCompleted = outcomes.filter((outcome) => outcome.child_outcome === "complete").length;
  await context.trace.append({
    run_id: context.runId,
    kind: "fanout.joined",
    step_id: step.id,
    attempt,
    policy: policy2,
    ...joinResult.winnerBranchId === void 0 ? {} : { selected_branch_id: joinResult.winnerBranchId },
    aggregate_path: aggregate.path,
    branches_completed: branchesCompleted,
    branches_failed: outcomes.length - branchesCompleted
  });
  if (joinResult.joinedSuccessfully) {
    await context.trace.append({
      run_id: context.runId,
      kind: "check.evaluated",
      step_id: step.id,
      attempt,
      check_kind: "fanout_aggregate",
      outcome: "pass"
    });
    return { route: "pass", details: { aggregate: aggregate.path } };
  }
  const reason = joinResult.failureReason ?? `fanout step '${step.id}': join policy '${policy2}' did not pass`;
  await context.trace.append({
    run_id: context.runId,
    kind: "check.evaluated",
    step_id: step.id,
    attempt,
    check_kind: "fanout_aggregate",
    outcome: "fail",
    reason
  });
  throw new Error(reason);
}

// dist/runtime/executors/sub-run.js
import { randomUUID as randomUUID2 } from "node:crypto";
import { mkdir as mkdir4, readFile as readFile4, writeFile as writeFile4 } from "node:fs/promises";
import { dirname as dirname3, join as join5 } from "node:path";
function checkPassVerdicts(step) {
  const pass = step.check.pass;
  return Array.isArray(pass) ? pass.filter((entry) => typeof entry === "string") : [];
}
async function recordSubRunCheckFailure(step, context, reason) {
  const attempt = context.activeStepAttempt ?? 1;
  await context.trace.append({
    run_id: context.runId,
    kind: "check.evaluated",
    step_id: step.id,
    attempt,
    check_kind: "result_verdict",
    outcome: "fail",
    reason
  });
  throw new Error(reason);
}
function evaluateChildResult(step, resultBody) {
  const verdict = resultBody.verdict;
  if (typeof verdict !== "string" || verdict.length === 0) {
    return {
      verdict: NO_VERDICT_SENTINEL,
      admitted: false,
      failureReason: `sub-run step '${step.id}': child result body lacks a non-empty string 'verdict' field`
    };
  }
  const pass = checkPassVerdicts(step);
  if (!pass.includes(verdict)) {
    return {
      verdict,
      admitted: false,
      failureReason: `sub-run step '${step.id}': child verdict '${verdict}' is not in check.pass [${pass.join(", ")}]`
    };
  }
  return { verdict, admitted: true };
}
function parseChildResultBody(step, childResultText) {
  let parsed;
  try {
    parsed = JSON.parse(childResultText);
  } catch (error) {
    return {
      failureReason: `sub-run step '${step.id}': child result body did not parse as JSON (${error.message})`
    };
  }
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    return {
      failureReason: `sub-run step '${step.id}': child result body parsed but is not a JSON object`
    };
  }
  try {
    return { body: RunResult.parse(parsed) };
  } catch (error) {
    return {
      failureReason: `sub-run step '${step.id}': child result body failed result schema (${error.message})`
    };
  }
}
async function executeSubRun(step, context) {
  const attempt = context.activeStepAttempt ?? 1;
  const resultWrite = step.writes?.result;
  if (resultWrite === void 0) {
    throw new Error(`sub-run step '${step.id}' is missing writes.result`);
  }
  if (step.writes?.report !== void 0 && step.writes.report.path !== resultWrite.path) {
    return await recordSubRunCheckFailure(step, context, `sub-run step '${step.id}': writes.report materialization at a path different from writes.result is not yet supported`);
  }
  if (context.childCompiledFlowResolver === void 0) {
    return await recordSubRunCheckFailure(step, context, `sub-run step '${step.id}': childCompiledFlowResolver is required to resolve child flow '${step.flowRef}'`);
  }
  if (context.childRunner === void 0) {
    return await recordSubRunCheckFailure(step, context, `sub-run step '${step.id}': childRunner is required to run child flow '${step.flowRef}'`);
  }
  let resolved;
  try {
    resolved = await context.childCompiledFlowResolver({
      flowId: step.flowRef,
      entryMode: step.entryMode,
      ...step.version === void 0 ? {} : { version: step.version }
    });
  } catch (error) {
    return await recordSubRunCheckFailure(step, context, `sub-run step '${step.id}': child flow resolution failed (${error.message})`);
  }
  let childFlow;
  try {
    childFlow = CompiledFlow.parse(JSON.parse(Buffer.from(resolved.flowBytes).toString("utf8")));
  } catch (error) {
    return await recordSubRunCheckFailure(step, context, `sub-run step '${step.id}': child flow resolution returned invalid compiled flow (${error.message})`);
  }
  if (childFlow.id !== step.flowRef) {
    return await recordSubRunCheckFailure(step, context, `sub-run step '${step.id}': resolver returned flow id '${childFlow.id}' but flow_ref names '${step.flowRef}'`);
  }
  const childRunId = randomUUID2();
  const childRunDir = join5(dirname3(context.runDir), childRunId);
  await mkdir4(dirname3(childRunDir), { recursive: true });
  await context.trace.append({
    run_id: context.runId,
    kind: "sub_run.started",
    step_id: step.id,
    attempt,
    child_run_id: childRunId,
    child_flow_id: childFlow.id,
    child_entry_mode: step.entryMode,
    child_depth: step.depth
  });
  const startMs = Date.now();
  let childResult;
  try {
    childResult = await context.childRunner({
      flowBytes: resolved.flowBytes,
      runDir: childRunDir,
      runId: childRunId,
      goal: step.goal,
      entryModeName: step.entryMode,
      depth: step.depth,
      now: context.now,
      ...context.childExecutors === void 0 ? {} : { executors: context.childExecutors },
      ...context.childCompiledFlowResolver === void 0 ? {} : { childCompiledFlowResolver: context.childCompiledFlowResolver },
      childRunner: context.childRunner,
      ...context.projectRoot === void 0 ? {} : { projectRoot: context.projectRoot },
      ...context.evidencePolicy === void 0 ? {} : { evidencePolicy: context.evidencePolicy },
      ...context.worktreeRunner === void 0 ? {} : { worktreeRunner: context.worktreeRunner },
      ...context.relayConnector === void 0 ? {} : { relayConnector: context.relayConnector },
      ...context.relayer === void 0 ? {} : { relayer: context.relayer },
      ...context.selectionConfigLayers === void 0 ? {} : { selectionConfigLayers: context.selectionConfigLayers },
      ...context.progress === void 0 ? {} : { progress: context.progress }
    });
  } catch (error) {
    return await recordSubRunCheckFailure(step, context, `sub-run step '${step.id}': child flow invocation failed (${error.message})`);
  }
  const durationMs = Math.max(0, Date.now() - startMs);
  const childResultText = await readFile4(childResult.resultPath, "utf8");
  const parentResultPath = context.files.resolve(resultWrite);
  await mkdir4(dirname3(parentResultPath), { recursive: true });
  await writeFile4(parentResultPath, childResultText, "utf8");
  const parsedChildResult = parseChildResultBody(step, childResultText);
  if (parsedChildResult.body === void 0) {
    const reason = parsedChildResult.failureReason ?? `sub-run step '${step.id}': child result body could not be parsed`;
    await context.trace.append({
      run_id: context.runId,
      kind: "sub_run.completed",
      step_id: step.id,
      attempt,
      child_run_id: childRunId,
      child_outcome: childResult.outcome,
      verdict: NO_VERDICT_SENTINEL,
      duration_ms: durationMs,
      result_path: resultWrite.path
    });
    return await recordSubRunCheckFailure(step, context, reason);
  }
  const childResultBody = parsedChildResult.body;
  const verdict = evaluateChildResult(step, childResultBody);
  const admitted = verdict.admitted && childResultBody.outcome === "complete";
  await context.trace.append({
    run_id: context.runId,
    kind: "sub_run.completed",
    step_id: step.id,
    attempt,
    child_run_id: childRunId,
    child_outcome: childResultBody.outcome,
    verdict: verdict.verdict,
    duration_ms: durationMs,
    result_path: resultWrite.path
  });
  if (admitted) {
    await context.trace.append({
      run_id: context.runId,
      kind: "check.evaluated",
      step_id: step.id,
      attempt,
      check_kind: "result_verdict",
      outcome: "pass"
    });
    return { route: "pass", details: { child_run_id: childRunId, verdict: verdict.verdict } };
  }
  return await recordSubRunCheckFailure(step, context, verdict.failureReason ?? `sub-run step '${step.id}': child closed with outcome '${childResultBody.outcome}'`);
}

// dist/runtime/executors/verification.js
import { spawnSync as spawnSync3 } from "node:child_process";
import { existsSync as existsSync6, lstatSync as lstatSync4, realpathSync as realpathSync3 } from "node:fs";
import { isAbsolute as isAbsolute4, relative as relative4, resolve as resolve6 } from "node:path";

// dist/flows/registries/verification-writers/registry.js
var REGISTRY6 = buildVerificationRegistry(flowPackages);
function findVerificationWriter(resultSchemaName) {
  return REGISTRY6.get(resultSchemaName);
}

// dist/runtime/executors/verification.js
var VERIFICATION_ENV_INHERIT_ALLOWLIST = [
  "PATH",
  "SystemRoot",
  "TEMP",
  "TMP",
  "TMPDIR",
  "WINDIR"
];
function isInsideOrSame2(root, target) {
  const fromRoot = relative4(root, target);
  return fromRoot === "" || !fromRoot.startsWith("..") && !isAbsolute4(fromRoot);
}
function resolveProjectRelativeCwd(projectRoot, cwd) {
  const rootAbs = resolve6(projectRoot);
  const targetAbs = resolve6(rootAbs, cwd);
  if (!isInsideOrSame2(rootAbs, targetAbs)) {
    throw new Error(`verification cwd rejected: ${JSON.stringify(cwd)} escapes project root`);
  }
  if (!existsSync6(rootAbs)) {
    throw new Error(`verification project root rejected: ${rootAbs} does not exist`);
  }
  const rootReal = realpathSync3.native(rootAbs);
  let cursor = rootAbs;
  for (const segment of cwd.split("/")) {
    if (segment === ".")
      continue;
    cursor = resolve6(cursor, segment);
    if (!existsSync6(cursor)) {
      throw new Error(`verification cwd rejected: ${JSON.stringify(cwd)} does not exist`);
    }
    const stat2 = lstatSync4(cursor);
    if (stat2.isSymbolicLink()) {
      throw new Error(`verification cwd rejected: ${JSON.stringify(cwd)} crosses symlink ${JSON.stringify(cursor)}`);
    }
    const cursorReal = realpathSync3.native(cursor);
    if (!isInsideOrSame2(rootReal, cursorReal)) {
      throw new Error(`verification cwd rejected: ${JSON.stringify(cwd)} escapes real project root through ${JSON.stringify(cursor)}`);
    }
  }
  const targetReal = realpathSync3.native(targetAbs);
  if (!isInsideOrSame2(rootReal, targetReal)) {
    throw new Error(`verification cwd rejected: ${JSON.stringify(cwd)} escapes real project root`);
  }
  return targetReal;
}
function verificationEnvironment(commandEnv) {
  const env = {};
  for (const key of VERIFICATION_ENV_INHERIT_ALLOWLIST) {
    const value = process.env[key];
    if (value !== void 0)
      env[key] = value;
  }
  return { ...env, ...commandEnv };
}
function summarizeOutput(value, maxBytes) {
  const bytes = Buffer.from(value);
  if (bytes.length <= maxBytes)
    return value;
  return bytes.subarray(0, maxBytes).toString("utf8");
}
function verificationFailureReason(stepId, error) {
  const message = error instanceof Error ? error.message : String(error);
  return `verification step '${stepId}': report writer failed (${message})`;
}
function runCommand(command, projectRoot) {
  const started = Date.now();
  const result = spawnSync3(command.argv[0], command.argv.slice(1), {
    cwd: resolveProjectRelativeCwd(projectRoot, command.cwd),
    env: verificationEnvironment(command.env),
    encoding: "utf8",
    maxBuffer: command.max_output_bytes,
    shell: false,
    timeout: command.timeout_ms
  });
  const exitCode = typeof result.status === "number" && result.error === void 0 ? result.status : 1;
  const stderrParts = [
    typeof result.stderr === "string" ? result.stderr : "",
    result.error === void 0 ? "" : result.error.message,
    result.signal === null ? "" : `signal: ${result.signal}`
  ].filter((part) => part.length > 0);
  return {
    command,
    exit_code: exitCode,
    status: exitCode === 0 ? "passed" : "failed",
    duration_ms: Math.max(0, Date.now() - started),
    stdout_summary: summarizeOutput(typeof result.stdout === "string" ? result.stdout : "", command.max_output_bytes),
    stderr_summary: summarizeOutput(stderrParts.join("\n"), command.max_output_bytes)
  };
}
async function executeVerification(step, context) {
  const attempt = context.activeStepAttempt ?? 1;
  let report;
  let reportSchema;
  let body;
  try {
    const stepReport = step.writes?.report;
    if (stepReport === void 0 || stepReport.schema === void 0) {
      throw new Error(`verification step '${step.id}' is missing writes.report schema`);
    }
    report = stepReport;
    reportSchema = stepReport.schema;
    if (context.projectRoot === void 0) {
      throw new Error(`verification step '${step.id}' requires projectRoot for project-relative cwd resolution`);
    }
    const projectRoot = context.projectRoot;
    const compiledFlow = requireCompiledFlow(context, step);
    const compiledStep = requireCompiledStep(context, step, "verification");
    const builder = findVerificationWriter(reportSchema);
    if (builder === void 0) {
      throw new Error(`verification step '${step.id}' has unsupported report schema`);
    }
    const commands = builder.loadCommands({
      runFolder: context.runDir,
      flow: compiledFlow,
      step: compiledStep
    });
    const observations = commands.map((command) => runCommand(command, projectRoot));
    body = builder.buildResult(observations);
    await context.files.writeJson(report, body);
  } catch (error) {
    const reason2 = verificationFailureReason(step.id, error);
    await context.trace.append({
      run_id: context.runId,
      kind: "check.evaluated",
      step_id: step.id,
      attempt,
      check_kind: "schema_sections",
      outcome: "fail",
      reason: reason2
    });
    throw new Error(reason2);
  }
  await context.trace.append({
    run_id: context.runId,
    kind: "step.report_written",
    step_id: step.id,
    attempt,
    report_path: report.path,
    report_schema: reportSchema
  });
  if (body.overall_status === "passed") {
    await context.trace.append({
      run_id: context.runId,
      kind: "check.evaluated",
      step_id: step.id,
      attempt,
      check_kind: "schema_sections",
      outcome: "pass"
    });
    return { route: "pass", details: { overall_status: "passed" } };
  }
  const reason = `verification step '${step.id}' failed one or more commands`;
  await context.trace.append({
    run_id: context.runId,
    kind: "check.evaluated",
    step_id: step.id,
    attempt,
    check_kind: "schema_sections",
    outcome: "fail",
    reason
  });
  const recoveryRoute = recoveryRouteForExecutableStep(step);
  if (recoveryRoute !== void 0) {
    return { route: recoveryRoute, details: { reason } };
  }
  throw new Error(reason);
}

// dist/runtime/executors/index.js
function unsupportedStep(step) {
  throw new Error(`step kind '${step.kind}' is not implemented in runtime baseline`);
}
function createDefaultExecutors(options = {}) {
  const relayConnector = options.relayConnector;
  return {
    compose: async (step, context) => {
      if (step.kind !== "compose")
        return unsupportedStep(step);
      return executeCompose(step, context);
    },
    relay: async (step, context) => {
      if (step.kind !== "relay")
        return unsupportedStep(step);
      return executeRelay(step, context, relayConnector);
    },
    verification: async (step, context) => {
      if (step.kind !== "verification")
        return unsupportedStep(step);
      return executeVerification(step, context);
    },
    checkpoint: async (step, context) => {
      if (step.kind !== "checkpoint")
        return unsupportedStep(step);
      return executeCheckpoint(step, context);
    },
    "sub-run": async (step, context) => {
      if (step.kind !== "sub-run")
        return unsupportedStep(step);
      return executeSubRun(step, context);
    },
    fanout: async (step, context) => {
      if (step.kind !== "fanout")
        return unsupportedStep(step);
      return executeFanout(step, context, relayConnector);
    }
  };
}

// dist/runtime/projections/progress.js
import { readFileSync as readFileSync15 } from "node:fs";
import { join as join8 } from "node:path";

// dist/schemas/progress-event.js
var MAX_STATUS_TEXT_CHARS = 180;
var MAX_DISPLAY_TEXT_CHARS = 240;
var ProgressDisplay = external_exports.object({
  text: external_exports.string().min(1).max(MAX_DISPLAY_TEXT_CHARS),
  importance: external_exports.enum(["major", "detail"]),
  tone: external_exports.enum(["info", "success", "warning", "error", "checkpoint"])
}).strict();
var ProgressPresentationLineMode = external_exports.enum(["append", "replace_slot", "suppress"]);
var ProgressPresentation = external_exports.object({
  block_id: external_exports.string().min(1).max(120),
  line_mode: ProgressPresentationLineMode,
  slot_id: external_exports.string().min(1).max(120).optional(),
  status_text: external_exports.string().min(1).max(MAX_STATUS_TEXT_CHARS).optional(),
  depth: external_exports.number().int().min(0).max(8).optional()
}).strict().superRefine((presentation, ctx) => {
  if (presentation.line_mode === "replace_slot" && presentation.slot_id === void 0) {
    ctx.addIssue({
      code: external_exports.ZodIssueCode.custom,
      path: ["slot_id"],
      message: "slot_id is required when line_mode is replace_slot"
    });
  }
  if (presentation.line_mode !== "suppress" && presentation.status_text === void 0) {
    ctx.addIssue({
      code: external_exports.ZodIssueCode.custom,
      path: ["status_text"],
      message: "status_text is required unless line_mode is suppress"
    });
  }
});
var ProgressTaskStatus = external_exports.enum(["pending", "in_progress", "completed", "failed"]);
var ProgressTask = external_exports.object({
  id: external_exports.string().min(1).max(96),
  title: external_exports.string().min(1).max(120),
  status: ProgressTaskStatus
}).strict();
var ProgressEventBase = external_exports.object({
  schema_version: external_exports.literal(1),
  type: external_exports.string().min(1),
  run_id: RunId,
  flow_id: CompiledFlowId,
  recorded_at: external_exports.string().datetime(),
  label: external_exports.string().min(1),
  display: ProgressDisplay,
  presentation: ProgressPresentation.optional()
}).strict();
var RunStartedProgressEvent = ProgressEventBase.extend({
  type: external_exports.literal("run.started"),
  run_folder: external_exports.string().min(1)
}).strict();
var RouteSelectedProgressEvent = ProgressEventBase.extend({
  type: external_exports.literal("route.selected"),
  selected_flow: CompiledFlowId,
  routed_by: external_exports.enum(["explicit", "classifier"]),
  router_reason: external_exports.string().min(1),
  router_signal: external_exports.string().min(1).optional(),
  entry_mode: external_exports.string().min(1).optional(),
  entry_mode_source: external_exports.enum(["explicit", "classifier"]).optional()
}).strict();
var StepStartedProgressEvent = ProgressEventBase.extend({
  type: external_exports.literal("step.started"),
  step_id: StepId,
  step_title: external_exports.string().min(1),
  attempt: external_exports.number().int().positive()
}).strict();
var StepCompletedProgressEvent = ProgressEventBase.extend({
  type: external_exports.literal("step.completed"),
  step_id: StepId,
  step_title: external_exports.string().min(1),
  attempt: external_exports.number().int().positive(),
  route_taken: external_exports.string().min(1)
}).strict();
var StepAbortedProgressEvent = ProgressEventBase.extend({
  type: external_exports.literal("step.aborted"),
  step_id: StepId,
  step_title: external_exports.string().min(1),
  attempt: external_exports.number().int().positive(),
  reason: external_exports.string().min(1)
}).strict();
var EvidenceCollectedProgressEvent = ProgressEventBase.extend({
  type: external_exports.literal("evidence.collected"),
  step_id: StepId,
  report_path: external_exports.string().min(1),
  report_schema: external_exports.string().min(1),
  warning_count: external_exports.number().int().nonnegative()
}).strict();
var EvidenceWarningProgressEvent = ProgressEventBase.extend({
  type: external_exports.literal("evidence.warning"),
  step_id: StepId,
  report_path: external_exports.string().min(1),
  warning_kind: external_exports.string().min(1),
  message: external_exports.string().min(1),
  path: external_exports.string().min(1).optional()
}).strict();
var RelayStartedProgressEvent = ProgressEventBase.extend({
  type: external_exports.literal("relay.started"),
  step_id: StepId,
  step_title: external_exports.string().min(1),
  attempt: external_exports.number().int().positive(),
  role: RelayRole,
  connector_name: external_exports.string().min(1),
  connector_kind: external_exports.enum(["builtin", "custom"]),
  filesystem_capability: external_exports.enum(["read-only", "trusted-write", "isolated-write"])
}).strict();
var RelayCompletedProgressEvent = ProgressEventBase.extend({
  type: external_exports.literal("relay.completed"),
  step_id: StepId,
  step_title: external_exports.string().min(1),
  attempt: external_exports.number().int().positive(),
  verdict: external_exports.string().min(1),
  duration_ms: external_exports.number().int().nonnegative()
}).strict();
var FanoutStartedProgressEvent = ProgressEventBase.extend({
  type: external_exports.literal("fanout.started"),
  step_id: StepId,
  step_title: external_exports.string().min(1),
  branch_count: external_exports.number().int().positive(),
  branch_ids: external_exports.array(external_exports.string().min(1)).min(1)
}).strict();
var FanoutBranchStartedProgressEvent = ProgressEventBase.extend({
  type: external_exports.literal("fanout.branch_started"),
  step_id: StepId,
  step_title: external_exports.string().min(1),
  branch_id: external_exports.string().min(1),
  branch_kind: external_exports.enum(["relay", "sub-run"]),
  child_run_id: RunId.optional(),
  worktree_path: external_exports.string().min(1).optional()
}).strict();
var FanoutBranchCompletedProgressEvent = ProgressEventBase.extend({
  type: external_exports.literal("fanout.branch_completed"),
  step_id: StepId,
  step_title: external_exports.string().min(1),
  branch_id: external_exports.string().min(1),
  branch_kind: external_exports.enum(["relay", "sub-run"]),
  child_run_id: RunId.optional(),
  child_outcome: RunClosedOutcome,
  verdict: external_exports.string().min(1),
  duration_ms: external_exports.number().int().nonnegative()
}).strict();
var FanoutJoinedProgressEvent = ProgressEventBase.extend({
  type: external_exports.literal("fanout.joined"),
  step_id: StepId,
  step_title: external_exports.string().min(1),
  policy: external_exports.enum(["pick-winner", "disjoint-merge", "aggregate-only"]),
  aggregate_path: external_exports.string().min(1),
  branches_completed: external_exports.number().int().nonnegative(),
  branches_failed: external_exports.number().int().nonnegative(),
  selected_branch_id: external_exports.string().min(1).optional()
}).strict();
var CheckpointWaitingProgressEvent = ProgressEventBase.extend({
  type: external_exports.literal("checkpoint.waiting"),
  step_id: StepId,
  request_path: external_exports.string().min(1),
  allowed_choices: external_exports.array(external_exports.string().min(1)).min(1)
}).strict();
var TaskListUpdatedProgressEvent = ProgressEventBase.extend({
  type: external_exports.literal("task_list.updated"),
  tasks: external_exports.array(ProgressTask).min(1)
}).strict();
var UserInputOption = external_exports.object({
  label: external_exports.string().min(1).max(80),
  description: external_exports.string().min(1).max(160),
  checkpoint_choice: external_exports.string().min(1).max(80)
}).strict();
var UserInputQuestion = external_exports.object({
  id: external_exports.string().min(1).max(80),
  header: external_exports.string().min(1).max(12),
  question: external_exports.string().min(1).max(240),
  options: external_exports.array(UserInputOption).min(1).max(4),
  allow_free_text: external_exports.literal(false)
}).strict();
var UserInputRequestedProgressEvent = ProgressEventBase.extend({
  type: external_exports.literal("user_input.requested"),
  checkpoint: external_exports.object({
    step_id: StepId,
    request_path: external_exports.string().min(1),
    allowed_choices: external_exports.array(external_exports.string().min(1)).min(1)
  }).strict(),
  questions: external_exports.array(UserInputQuestion).min(1).max(3),
  resume: external_exports.object({
    run_folder: external_exports.string().min(1),
    checkpoint_choice_arg: external_exports.string().min(1),
    command: external_exports.string().min(1)
  }).strict()
}).strict();
var RunCompletedProgressEvent = ProgressEventBase.extend({
  type: external_exports.literal("run.completed"),
  outcome: RunClosedOutcome,
  result_path: external_exports.string().min(1)
}).strict();
var RunAbortedProgressEvent = ProgressEventBase.extend({
  type: external_exports.literal("run.aborted"),
  outcome: external_exports.literal("aborted"),
  result_path: external_exports.string().min(1),
  reason: external_exports.string().min(1).optional()
}).strict();
var ProgressEvent = external_exports.discriminatedUnion("type", [
  RunStartedProgressEvent,
  RouteSelectedProgressEvent,
  StepStartedProgressEvent,
  StepCompletedProgressEvent,
  StepAbortedProgressEvent,
  EvidenceCollectedProgressEvent,
  EvidenceWarningProgressEvent,
  RelayStartedProgressEvent,
  RelayCompletedProgressEvent,
  FanoutStartedProgressEvent,
  FanoutBranchStartedProgressEvent,
  FanoutBranchCompletedProgressEvent,
  FanoutJoinedProgressEvent,
  CheckpointWaitingProgressEvent,
  TaskListUpdatedProgressEvent,
  UserInputRequestedProgressEvent,
  RunCompletedProgressEvent,
  RunAbortedProgressEvent
]);

// dist/shared/progress-output.js
function reportProgress(progress, event) {
  if (progress === void 0)
    return;
  try {
    progress(event);
  } catch {
  }
}
function progressDisplay(text, importance, tone) {
  if (text.length <= MAX_DISPLAY_TEXT_CHARS)
    return { text, importance, tone };
  return {
    text: `${text.slice(0, MAX_DISPLAY_TEXT_CHARS - 14)} [truncated]`,
    importance,
    tone
  };
}
function truncateStatusText(text) {
  if (text.length <= MAX_STATUS_TEXT_CHARS)
    return text;
  return `${text.slice(0, MAX_STATUS_TEXT_CHARS - 14)} [truncated]`;
}
function normalizeStatusText(text) {
  const withoutChrome = text.replace(/^Circuit:\s*/i, "").replace(/^⎿\s*/, "").trim();
  return truncateStatusText(withoutChrome);
}
function statusTextFromHeadline(headline) {
  const stripped = headline.replace(/^Circuit:\s*/i, "").trim();
  const withSentence = /[.!?]$/.test(stripped) ? stripped : `${stripped}.`;
  return truncateStatusText(withSentence);
}
function progressPresentation(input) {
  const lineMode = input.lineMode ?? "append";
  return {
    block_id: input.blockId,
    line_mode: lineMode,
    ...input.slotId === void 0 ? {} : { slot_id: input.slotId },
    ...input.statusText === void 0 ? {} : { status_text: normalizeStatusText(input.statusText) },
    ...input.depth === void 0 ? {} : { depth: input.depth }
  };
}

// dist/shared/result-path.js
import { join as join6 } from "node:path";
var RUN_RESULT_RELATIVE_PATH = "reports/result.json";
function runResultPath(runFolder) {
  return join6(runFolder, RUN_RESULT_RELATIVE_PATH);
}

// dist/shared/write-capable-worker-disclosure.js
var WRITE_CAPABLE_FLOW_IDS = /* @__PURE__ */ new Set(["build", "fix", "migrate", "sweep"]);
var WRITE_CAPABLE_WORKER_DISCLOSURE = "A worker can edit this checkout.";
function flowMayInvokeWriteCapableWorker(flowId) {
  return WRITE_CAPABLE_FLOW_IDS.has(flowId);
}
function compiledFlowMayInvokeWriteCapableWorker(flow) {
  return flowMayInvokeWriteCapableWorker(flow.id) || flow.steps.some((step) => step.kind === "relay" && step.role === "implementer");
}

// dist/runtime/projections/tournament-checkpoint-context.js
import { readFileSync as readFileSync14 } from "node:fs";
import { join as join7 } from "node:path";
function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
function boundedText(value, max) {
  if (value.length <= max)
    return value;
  return `${value.slice(0, Math.max(0, max - 1)).trimEnd()}.`;
}
function readJson2(runDir, path) {
  try {
    return JSON.parse(readFileSync14(join7(runDir, path), "utf8"));
  } catch {
    return void 0;
  }
}
function optionPresentationById(runDir) {
  const raw = readJson2(runDir, "reports/decision-options.json");
  if (!isRecord(raw) || !Array.isArray(raw.options))
    return /* @__PURE__ */ new Map();
  const entries = [];
  for (const option of raw.options) {
    if (!isRecord(option))
      continue;
    const id = option.id;
    const label = option.label;
    if (typeof id !== "string" || typeof label !== "string")
      continue;
    const description = typeof option.summary === "string" ? option.summary : typeof option.best_case_prompt === "string" ? option.best_case_prompt : `Resume with '${id}'.`;
    entries.push([
      id,
      {
        id,
        label: boundedText(label, 80),
        description: boundedText(description, 160)
      }
    ]);
  }
  return new Map(entries);
}
function tournamentQuestion(runDir) {
  const raw = readJson2(runDir, "reports/tournament-review.json");
  if (!isRecord(raw))
    return void 0;
  const question = raw.tradeoff_question;
  return typeof question === "string" && question.trim().length > 0 ? boundedText(question.trim(), 240) : void 0;
}
function tournamentCheckpointPresentation(input) {
  const byId = optionPresentationById(input.runDir);
  return {
    prompt: tournamentQuestion(input.runDir) ?? boundedText(input.fallbackPrompt, 240),
    choices: input.allowedChoices.map((choice) => {
      const dynamic = byId.get(choice);
      if (dynamic !== void 0)
        return dynamic;
      return {
        id: choice,
        label: boundedText(input.fallbackLabel(choice), 80),
        description: boundedText(input.fallbackDescription(choice), 160)
      };
    })
  };
}

// dist/runtime/projections/progress.js
function connectorFilesystemCapability(connector) {
  return connector.kind === "builtin" ? BUILTIN_CONNECTOR_CAPABILITIES[connector.name].filesystem : connector.capabilities.filesystem;
}
function connectorFromTrace(entry) {
  const connector = entry.connector;
  if (connector === void 0 || connector === null || typeof connector !== "object") {
    return void 0;
  }
  const record = connector;
  if (record.kind === "builtin" && (record.name === "claude-code" || record.name === "codex")) {
    return { kind: "builtin", name: record.name };
  }
  if (record.kind === "custom" && typeof record.name === "string" && Array.isArray(record.command) && record.capabilities !== void 0) {
    return connector;
  }
  return void 0;
}
function relayRoleFromTrace(entry) {
  const role = entry.role;
  return role === "reviewer" || role === "implementer" ? role : void 0;
}
function stepTitle(input) {
  if (input.stepId === void 0)
    return "<unknown step>";
  return input.compiledFlow?.steps.find((step) => step.id === input.stepId)?.title ?? input.flow.steps.find((step) => step.id === input.stepId)?.title ?? input.stepId;
}
function flowLabel(flowId) {
  return flowId.split("-").filter((part) => part.length > 0).map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`).join(" ");
}
function stepLead(title) {
  return title.split("\u2014")[0]?.trim().toLowerCase() ?? title.toLowerCase();
}
function operatorStepTitle(flowId, title) {
  const lead = stepLead(title);
  if (lead.startsWith("frame") || lead.startsWith("intake"))
    return "Frame the work";
  if (lead.startsWith("analyze") || lead.startsWith("inventory"))
    return "Check the context";
  if (lead.startsWith("synthesize") || lead.startsWith("compose")) {
    return flowId === "explore" ? "Draft the recommendation" : "Draft the result";
  }
  if (lead.startsWith("review") || lead.startsWith("independent") || lead.startsWith("release")) {
    return flowId === "explore" ? "Check the recommendation" : "Check the result";
  }
  if (lead.startsWith("close"))
    return "Wrap up";
  if (lead.startsWith("verify"))
    return "Check the work";
  if (lead.startsWith("plan") || lead.startsWith("coexistence"))
    return "Plan the work";
  if (lead.startsWith("act") || lead.startsWith("batch") || lead.startsWith("execute")) {
    return "Make the change";
  }
  return title.replace(/\s+—\s+.+$/, "").replace(/\s+\(.+\)$/, "");
}
function operatorStepAction(flowId, title) {
  const lead = stepLead(title);
  if (lead.startsWith("frame") || lead.startsWith("intake"))
    return "Framing the work";
  if (lead.startsWith("analyze") || lead.startsWith("inventory"))
    return "Checking the context";
  if (lead.startsWith("synthesize") || lead.startsWith("compose")) {
    return flowId === "explore" ? "Drafting the recommendation" : "Drafting the result";
  }
  if (lead.startsWith("review") || lead.startsWith("independent") || lead.startsWith("release")) {
    return flowId === "explore" ? "Checking the recommendation" : "Checking the result";
  }
  if (lead.startsWith("close"))
    return "Wrapping up";
  if (lead.startsWith("verify"))
    return "Checking the work";
  if (lead.startsWith("plan") || lead.startsWith("coexistence"))
    return "Planning the work";
  if (lead.startsWith("act") || lead.startsWith("batch") || lead.startsWith("execute")) {
    return "Making the change";
  }
  return `Working on ${operatorStepTitle(flowId, title).toLowerCase()}`;
}
function relayStartedStatusText(flowId, role) {
  if (role === "reviewer") {
    return flowId === "explore" ? "Asking the reviewer to check the recommendation..." : "Asking the reviewer to check the result...";
  }
  return flowId === "explore" ? "Asking the specialist to draft the recommendation..." : "Asking the specialist to make the change...";
}
function relayCompletedStatusText(flowId, role) {
  if (role === "reviewer") {
    return flowId === "explore" ? "Finished checking the recommendation." : "Finished checking the result.";
  }
  return flowId === "explore" ? "Finished drafting the recommendation." : "Finished the specialist pass.";
}
function relayRoleFromStepTitle(title) {
  const lead = stepLead(title);
  return lead.startsWith("review") || lead.startsWith("independent") || lead.startsWith("release") ? "reviewer" : "implementer";
}
function circuitDisplayText(statusText) {
  return `Circuit: ${statusText}`;
}
function appendStatus(blockId, statusText) {
  return progressPresentation({ blockId, lineMode: "append", statusText });
}
function replaceStatus(blockId, slotId, statusText) {
  return progressPresentation({
    blockId,
    lineMode: "replace_slot",
    slotId,
    statusText
  });
}
function suppressStatus(blockId) {
  return progressPresentation({ blockId, lineMode: "suppress" });
}
function progressTasks(flow, statuses) {
  return flow.steps.map((step) => ({
    id: step.id,
    title: operatorStepTitle(flow.id, step.title ?? step.id),
    status: statuses.get(step.id) ?? "pending"
  }));
}
function reportTaskListProgress(input) {
  reportProgress(input.progress, {
    schema_version: 1,
    type: "task_list.updated",
    run_id: input.runId,
    flow_id: input.flowId,
    recorded_at: input.recordedAt,
    label: input.label,
    display: progressDisplay(input.displayText, "detail", input.tone ?? "info"),
    presentation: suppressStatus(input.runId),
    tasks: progressTasks(input.flow, input.statuses)
  });
}
function readJsonReport2(runDir, reportPath) {
  return JSON.parse(readFileSync15(join8(runDir, reportPath), "utf8"));
}
function warningRecordsFromReport(body) {
  if (body === null || typeof body !== "object" || Array.isArray(body))
    return [];
  const raw = body.evidence_warnings;
  if (!Array.isArray(raw))
    return [];
  return raw.flatMap((item) => {
    if (item === null || typeof item !== "object" || Array.isArray(item))
      return [];
    const record = item;
    if (typeof record.kind !== "string" || typeof record.message !== "string")
      return [];
    return [
      {
        kind: record.kind,
        message: record.message,
        ...typeof record.path === "string" ? { path: record.path } : {}
      }
    ];
  });
}
function reportEvidenceProgress(input) {
  if (input.traceEntry.step_id === void 0 || input.traceEntry.report_path === void 0 || input.traceEntry.report_schema === void 0) {
    return;
  }
  let body;
  try {
    body = readJsonReport2(input.runDir, input.traceEntry.report_path);
  } catch {
    return;
  }
  if (body === null || typeof body !== "object" || Array.isArray(body))
    return;
  const record = body;
  const hasEvidence = Object.hasOwn(record, "evidence");
  const warnings = warningRecordsFromReport(record);
  if (!hasEvidence && warnings.length === 0)
    return;
  reportProgress(input.progress, {
    schema_version: 1,
    type: "evidence.collected",
    run_id: input.runId,
    flow_id: input.flowId,
    recorded_at: input.recordedAt,
    label: warnings.length > 0 ? "Collected evidence with warnings" : "Collected evidence",
    display: progressDisplay(warnings.length > 0 ? `Circuit: Collected evidence with ${warnings.length} warning${warnings.length === 1 ? "" : "s"}.` : "Circuit: Collected evidence.", "major", warnings.length > 0 ? "warning" : "info"),
    presentation: warnings.length > 0 ? appendStatus(input.runId, `Collected evidence with ${warnings.length} warning${warnings.length === 1 ? "" : "s"}.`) : suppressStatus(input.runId),
    step_id: input.traceEntry.step_id,
    report_path: input.traceEntry.report_path,
    report_schema: input.traceEntry.report_schema,
    warning_count: warnings.length
  });
  for (const warning of warnings) {
    reportProgress(input.progress, {
      schema_version: 1,
      type: "evidence.warning",
      run_id: input.runId,
      flow_id: input.flowId,
      recorded_at: input.recordedAt,
      label: "Evidence warning",
      display: progressDisplay(`Circuit: Evidence warning: ${warning.message}`, "major", "warning"),
      presentation: appendStatus(input.runId, `Evidence warning: ${warning.message}`),
      step_id: input.traceEntry.step_id,
      report_path: input.traceEntry.report_path,
      warning_kind: warning.kind,
      message: warning.message,
      ...warning.path === void 0 ? {} : { path: warning.path }
    });
  }
}
function runOutcome(entry) {
  const outcome = entry.outcome;
  if (outcome === "complete" || outcome === "stopped" || outcome === "handoff" || outcome === "escalated" || outcome === "aborted") {
    return outcome;
  }
  return "aborted";
}
function runReason(entry) {
  const reason = entry.reason;
  return typeof reason === "string" && reason.length > 0 ? reason : void 0;
}
function stringArray(value) {
  if (!Array.isArray(value))
    return void 0;
  const entries = value.filter((entry) => typeof entry === "string");
  return entries.length === value.length && entries.length > 0 ? entries : void 0;
}
function checkpointPrompt(requestPath) {
  try {
    const raw = JSON.parse(readFileSync15(requestPath, "utf8"));
    if (raw !== null && typeof raw === "object" && !Array.isArray(raw)) {
      const prompt = raw.prompt;
      if (typeof prompt === "string" && prompt.length > 0)
        return prompt;
    }
  } catch {
  }
  return "Choose how to continue this checkpoint.";
}
function checkpointChoiceLabel(choice) {
  return choice.split(/[-_]/).filter((part) => part.length > 0).map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`).join(" ");
}
function checkpointRequestPath(runDir, requestPath) {
  return requestPath.startsWith("/") ? requestPath : join8(runDir, requestPath);
}
function fanoutChildOutcome(value) {
  if (value === "complete" || value === "aborted" || value === "handoff" || value === "stopped" || value === "escalated") {
    return value;
  }
  return void 0;
}
function fanoutPolicy(value) {
  if (value === "pick-winner" || value === "disjoint-merge" || value === "aggregate-only") {
    return value;
  }
  return void 0;
}
function fanoutBranchKind(value) {
  if (value === "relay" || value === "sub-run")
    return value;
  return void 0;
}
function shouldWarnAboutWriteCapableWorker(flow, compiledFlow) {
  if (compiledFlow !== void 0)
    return compiledFlowMayInvokeWriteCapableWorker(compiledFlow);
  return flowMayInvokeWriteCapableWorker(flow.id) || flow.steps.some((step) => step.kind === "relay" && step.role === "implementer");
}
function createProgressProjector(input) {
  const taskStatuses = new Map(input.flow.steps.map((step) => [step.id, "pending"]));
  const activeAttempts = /* @__PURE__ */ new Map();
  const flowId = input.flow.id;
  const runId = input.runId;
  return (entry) => {
    const recordedAt = entry.recorded_at ?? (/* @__PURE__ */ new Date(0)).toISOString();
    switch (entry.kind) {
      case "run.bootstrapped": {
        const shouldWarn = shouldWarnAboutWriteCapableWorker(input.flow, input.compiledFlow);
        const startedText = `Circuit: Started ${flowLabel(input.flow.id)}.`;
        reportProgress(input.progress, {
          schema_version: 1,
          type: "run.started",
          run_id: runId,
          flow_id: flowId,
          recorded_at: recordedAt,
          label: "Started Circuit run",
          display: progressDisplay(shouldWarn ? `${startedText} ${WRITE_CAPABLE_WORKER_DISCLOSURE}` : startedText, "major", shouldWarn ? "warning" : "info"),
          presentation: shouldWarn ? appendStatus(runId, WRITE_CAPABLE_WORKER_DISCLOSURE) : suppressStatus(runId),
          run_folder: input.runDir
        });
        reportTaskListProgress({
          progress: input.progress,
          runId,
          flowId,
          flow: input.flow,
          recordedAt,
          statuses: taskStatuses,
          label: "Flow checklist initialized",
          displayText: "Circuit: Prepared the flow checklist."
        });
        break;
      }
      case "step.entered": {
        const stepId = entry.step_id;
        if (stepId === void 0 || entry.attempt === void 0)
          break;
        activeAttempts.set(stepId, entry.attempt);
        taskStatuses.set(stepId, "in_progress");
        const title = stepTitle({ flow: input.flow, compiledFlow: input.compiledFlow, stepId });
        reportProgress(input.progress, {
          schema_version: 1,
          type: "step.started",
          run_id: runId,
          flow_id: flowId,
          recorded_at: recordedAt,
          label: title,
          display: progressDisplay(`Circuit: ${operatorStepAction(input.flow.id, title)}...`, "major", "info"),
          presentation: appendStatus(runId, `${operatorStepAction(input.flow.id, title)}...`),
          step_id: stepId,
          step_title: title,
          attempt: entry.attempt
        });
        reportTaskListProgress({
          progress: input.progress,
          runId,
          flowId,
          flow: input.flow,
          recordedAt,
          statuses: taskStatuses,
          label: `${title} in progress`,
          displayText: `Circuit: ${operatorStepAction(input.flow.id, title)}...`
        });
        break;
      }
      case "relay.started": {
        const stepId = entry.step_id;
        if (stepId === void 0)
          break;
        const connector = connectorFromTrace(entry);
        const role = relayRoleFromTrace(entry);
        if (connector === void 0 || role === void 0)
          break;
        const title = stepTitle({ flow: input.flow, compiledFlow: input.compiledFlow, stepId });
        const capability = connectorFilesystemCapability(connector);
        const statusText = relayStartedStatusText(input.flow.id, role);
        reportProgress(input.progress, {
          schema_version: 1,
          type: "relay.started",
          run_id: runId,
          flow_id: flowId,
          recorded_at: recordedAt,
          label: `Running ${role} relay with ${connector.name}`,
          display: progressDisplay(circuitDisplayText(statusText), "major", "info"),
          presentation: replaceStatus(runId, `${stepId}:relay`, statusText),
          step_id: stepId,
          step_title: title,
          attempt: activeAttempts.get(stepId) ?? entry.attempt ?? 1,
          role,
          connector_name: connector.name,
          connector_kind: connector.kind,
          filesystem_capability: capability
        });
        break;
      }
      case "relay.completed": {
        const stepId = entry.step_id;
        if (stepId === void 0 || entry.verdict === void 0 || entry.duration_ms === void 0) {
          break;
        }
        const title = stepTitle({ flow: input.flow, compiledFlow: input.compiledFlow, stepId });
        const role = relayRoleFromTrace(entry) ?? relayRoleFromStepTitle(title);
        const statusText = relayCompletedStatusText(input.flow.id, role);
        reportProgress(input.progress, {
          schema_version: 1,
          type: "relay.completed",
          run_id: runId,
          flow_id: flowId,
          recorded_at: recordedAt,
          label: `Relay completed with ${entry.verdict}`,
          display: progressDisplay(circuitDisplayText(statusText), "major", "success"),
          presentation: replaceStatus(runId, `${stepId}:relay`, statusText),
          step_id: stepId,
          step_title: title,
          attempt: activeAttempts.get(stepId) ?? entry.attempt ?? 1,
          verdict: entry.verdict,
          duration_ms: entry.duration_ms
        });
        break;
      }
      case "step.report_written": {
        reportEvidenceProgress({
          progress: input.progress,
          runDir: input.runDir,
          flowId,
          runId,
          recordedAt,
          traceEntry: entry
        });
        break;
      }
      case "fanout.started": {
        const stepId = entry.step_id;
        const branchIds = stringArray(entry.branch_ids);
        if (stepId === void 0 || branchIds === void 0)
          break;
        const title = stepTitle({ flow: input.flow, compiledFlow: input.compiledFlow, stepId });
        reportProgress(input.progress, {
          schema_version: 1,
          type: "fanout.started",
          run_id: runId,
          flow_id: flowId,
          recorded_at: recordedAt,
          label: `Started ${title} fanout`,
          display: progressDisplay(`Circuit: Comparing ${branchIds.length} option${branchIds.length === 1 ? "" : "s"}...`, "major", "info"),
          presentation: replaceStatus(runId, `${stepId}:fanout`, `Comparing ${branchIds.length} option${branchIds.length === 1 ? "" : "s"}...`),
          step_id: stepId,
          step_title: title,
          branch_count: branchIds.length,
          branch_ids: branchIds
        });
        break;
      }
      case "fanout.branch_started": {
        const stepId = entry.step_id;
        const branchKind = fanoutBranchKind(entry.branch_kind);
        if (stepId === void 0 || entry.branch_id === void 0 || branchKind === void 0) {
          break;
        }
        const title = stepTitle({ flow: input.flow, compiledFlow: input.compiledFlow, stepId });
        reportProgress(input.progress, {
          schema_version: 1,
          type: "fanout.branch_started",
          run_id: runId,
          flow_id: flowId,
          recorded_at: recordedAt,
          label: `Started branch ${entry.branch_id}`,
          display: progressDisplay(`Circuit: Started branch ${entry.branch_id}.`, "detail", "info"),
          presentation: suppressStatus(runId),
          step_id: stepId,
          step_title: title,
          branch_id: entry.branch_id,
          branch_kind: branchKind,
          ...entry.child_run_id === void 0 ? {} : { child_run_id: entry.child_run_id },
          ...entry.worktree_path === void 0 ? {} : { worktree_path: entry.worktree_path }
        });
        break;
      }
      case "fanout.branch_completed": {
        const stepId = entry.step_id;
        const childOutcome = fanoutChildOutcome(entry.child_outcome);
        const branchKind = fanoutBranchKind(entry.branch_kind);
        if (stepId === void 0 || entry.branch_id === void 0 || branchKind === void 0 || childOutcome === void 0 || entry.verdict === void 0 || entry.duration_ms === void 0) {
          break;
        }
        const title = stepTitle({ flow: input.flow, compiledFlow: input.compiledFlow, stepId });
        reportProgress(input.progress, {
          schema_version: 1,
          type: "fanout.branch_completed",
          run_id: runId,
          flow_id: flowId,
          recorded_at: recordedAt,
          label: `Branch ${entry.branch_id} ${childOutcome}`,
          display: progressDisplay(`Circuit: Branch ${entry.branch_id} ${childOutcome}.`, "detail", childOutcome === "complete" ? "success" : "error"),
          presentation: suppressStatus(runId),
          step_id: stepId,
          step_title: title,
          branch_id: entry.branch_id,
          branch_kind: branchKind,
          ...entry.child_run_id === void 0 ? {} : { child_run_id: entry.child_run_id },
          child_outcome: childOutcome,
          verdict: entry.verdict,
          duration_ms: entry.duration_ms
        });
        break;
      }
      case "fanout.joined": {
        const stepId = entry.step_id;
        const policy2 = fanoutPolicy(entry.policy);
        if (stepId === void 0 || policy2 === void 0 || entry.aggregate_path === void 0 || entry.branches_completed === void 0 || entry.branches_failed === void 0) {
          break;
        }
        const title = stepTitle({ flow: input.flow, compiledFlow: input.compiledFlow, stepId });
        reportProgress(input.progress, {
          schema_version: 1,
          type: "fanout.joined",
          run_id: runId,
          flow_id: flowId,
          recorded_at: recordedAt,
          label: `Joined ${title}`,
          display: progressDisplay("Circuit: Finished comparing the options.", "major", "success"),
          presentation: replaceStatus(runId, `${stepId}:fanout`, "Finished comparing the options."),
          step_id: stepId,
          step_title: title,
          policy: policy2,
          aggregate_path: entry.aggregate_path,
          branches_completed: entry.branches_completed,
          branches_failed: entry.branches_failed,
          ...entry.selected_branch_id === void 0 ? {} : { selected_branch_id: entry.selected_branch_id }
        });
        break;
      }
      case "checkpoint.requested": {
        const stepId = entry.step_id;
        const allowedChoices = stringArray(entry.options);
        if (stepId === void 0 || entry.request_path === void 0 || allowedChoices === void 0) {
          break;
        }
        if (entry.auto_resolved === true) {
          break;
        }
        const requestPath = checkpointRequestPath(input.runDir, entry.request_path);
        taskStatuses.set(stepId, "in_progress");
        const title = stepTitle({ flow: input.flow, compiledFlow: input.compiledFlow, stepId });
        const checkpointPromptText = checkpointPrompt(requestPath);
        const presentation = tournamentCheckpointPresentation({
          runDir: input.runDir,
          allowedChoices,
          fallbackPrompt: checkpointPromptText,
          fallbackLabel: checkpointChoiceLabel,
          fallbackDescription: (choice) => `Resume with '${choice}'.`
        });
        reportProgress(input.progress, {
          schema_version: 1,
          type: "checkpoint.waiting",
          run_id: runId,
          flow_id: flowId,
          recorded_at: recordedAt,
          label: `Waiting for checkpoint ${stepId}`,
          display: progressDisplay(`Circuit: Waiting for a checkpoint choice: ${presentation.choices.map((choice) => choice.label).join(", ")}...`, "major", "checkpoint"),
          presentation: appendStatus(runId, "Waiting for your choice..."),
          step_id: stepId,
          request_path: requestPath,
          allowed_choices: allowedChoices
        });
        reportProgress(input.progress, {
          schema_version: 1,
          type: "user_input.requested",
          run_id: runId,
          flow_id: flowId,
          recorded_at: recordedAt,
          label: "Checkpoint choice requested",
          display: progressDisplay(presentation.prompt, "major", "checkpoint"),
          presentation: suppressStatus(runId),
          checkpoint: {
            step_id: stepId,
            request_path: requestPath,
            allowed_choices: allowedChoices
          },
          questions: [
            {
              id: "checkpoint-choice",
              header: "Choice",
              question: presentation.prompt,
              options: presentation.choices.map((choice) => ({
                label: choice.label,
                description: choice.description,
                checkpoint_choice: choice.id
              })),
              allow_free_text: false
            }
          ],
          resume: {
            run_folder: input.runDir,
            checkpoint_choice_arg: "<choice>",
            command: `circuit-next resume --run-folder ${input.runDir} --checkpoint-choice <choice>`
          }
        });
        reportTaskListProgress({
          progress: input.progress,
          runId,
          flowId,
          flow: input.flow,
          recordedAt,
          statuses: taskStatuses,
          label: `${title} waiting`,
          displayText: "Circuit: Waiting for your choice...",
          tone: "checkpoint"
        });
        break;
      }
      case "step.completed": {
        const stepId = entry.step_id;
        if (stepId === void 0 || entry.attempt === void 0 || entry.route_taken === void 0) {
          break;
        }
        taskStatuses.set(stepId, "completed");
        const title = stepTitle({ flow: input.flow, compiledFlow: input.compiledFlow, stepId });
        reportProgress(input.progress, {
          schema_version: 1,
          type: "step.completed",
          run_id: runId,
          flow_id: flowId,
          recorded_at: recordedAt,
          label: `Completed ${title}`,
          display: progressDisplay(`Finished ${operatorStepAction(input.flow.id, title).toLowerCase()}.`, "detail", "success"),
          presentation: suppressStatus(runId),
          step_id: stepId,
          step_title: title,
          attempt: entry.attempt,
          route_taken: entry.route_taken
        });
        reportTaskListProgress({
          progress: input.progress,
          runId,
          flowId,
          flow: input.flow,
          recordedAt,
          statuses: taskStatuses,
          label: `${title} completed`,
          displayText: `Finished ${operatorStepAction(input.flow.id, title).toLowerCase()}.`,
          tone: "success"
        });
        break;
      }
      case "step.aborted": {
        const stepId = entry.step_id;
        if (stepId === void 0 || entry.attempt === void 0 || entry.reason === void 0) {
          break;
        }
        taskStatuses.set(stepId, "failed");
        const title = stepTitle({ flow: input.flow, compiledFlow: input.compiledFlow, stepId });
        reportProgress(input.progress, {
          schema_version: 1,
          type: "step.aborted",
          run_id: runId,
          flow_id: flowId,
          recorded_at: recordedAt,
          label: `Aborted ${title}`,
          display: progressDisplay(`Circuit: Aborted ${title}: ${entry.reason}`, "major", "error"),
          presentation: appendStatus(runId, `Marked ${operatorStepTitle(input.flow.id, title)} as failed.`),
          step_id: stepId,
          step_title: title,
          attempt: entry.attempt,
          reason: entry.reason
        });
        reportTaskListProgress({
          progress: input.progress,
          runId,
          flowId,
          flow: input.flow,
          recordedAt,
          statuses: taskStatuses,
          label: `${title} failed`,
          displayText: `Circuit: Marked ${title} as failed.`,
          tone: "error"
        });
        break;
      }
      case "run.closed": {
        const outcome = runOutcome(entry);
        if (outcome === "aborted") {
          const reason = runReason(entry);
          reportProgress(input.progress, {
            schema_version: 1,
            type: "run.aborted",
            run_id: runId,
            flow_id: flowId,
            recorded_at: recordedAt,
            label: "Circuit run aborted",
            display: progressDisplay(reason === void 0 ? "Circuit: Run aborted." : `Circuit: Run aborted: ${reason}`, "major", "error"),
            presentation: appendStatus(runId, reason === void 0 ? "Run aborted." : `Run aborted: ${reason}`),
            outcome,
            result_path: runResultPath(input.runDir),
            ...reason === void 0 ? {} : { reason }
          });
        } else {
          reportProgress(input.progress, {
            schema_version: 1,
            type: "run.completed",
            run_id: runId,
            flow_id: flowId,
            recorded_at: recordedAt,
            label: `Circuit run ${outcome}`,
            display: progressDisplay(`Circuit: Finished ${flowLabel(input.flow.id)}.`, "major", "success"),
            presentation: appendStatus(runId, `Finished ${flowLabel(input.flow.id)}.`),
            outcome,
            result_path: runResultPath(input.runDir)
          });
        }
        break;
      }
      default:
        break;
    }
  };
}

// dist/runtime/run-files/report-validator.js
var MinimalVerdictShape2 = external_exports.object({ verdict: external_exports.string().min(1) }).passthrough();
var StrictPayloadShape2 = external_exports.object({
  verdict: external_exports.string().min(1),
  rationale: external_exports.string().min(1)
}).strict();
var FanoutAggregateFixtureBranchShape2 = external_exports.object({
  branch_id: external_exports.string().min(1),
  child_run_id: external_exports.string().min(1),
  child_outcome: external_exports.string().min(1),
  verdict: external_exports.string().min(1),
  admitted: external_exports.boolean(),
  result_path: external_exports.string().min(1),
  duration_ms: external_exports.number().nonnegative()
}).passthrough();
var FanoutAggregateFixtureShape2 = external_exports.object({
  schema_version: external_exports.literal(1),
  join_policy: external_exports.enum(["pick-winner", "disjoint-merge", "aggregate-only"]),
  branch_count: external_exports.number().int().nonnegative(),
  winner_branch_id: external_exports.string().min(1).optional(),
  branches: external_exports.array(FanoutAggregateFixtureBranchShape2)
}).passthrough();
var TEST_FIXTURE_SCHEMAS2 = Object.freeze({
  "runtime-proof-canonical@v1": MinimalVerdictShape2,
  "runtime-proof-strict@v1": StrictPayloadShape2,
  "fanout-aggregate@v1": FanoutAggregateFixtureShape2
});
function buildReportValidationRegistry() {
  const out = { ...TEST_FIXTURE_SCHEMAS2 };
  for (const pkg of flowPackages) {
    for (const report of pkg.reportSchemas ?? []) {
      if (Object.hasOwn(out, report.schemaName)) {
        throw new Error(`duplicate report schema '${report.schemaName}' registered (flow ${pkg.id})`);
      }
      out[report.schemaName] = report.schema;
    }
    for (const report of pkg.relayReports) {
      if (Object.hasOwn(out, report.schemaName)) {
        throw new Error(`duplicate relay report schema '${report.schemaName}' registered (flow ${pkg.id})`);
      }
      out[report.schemaName] = report.schema;
    }
  }
  return Object.freeze(out);
}
var REGISTRY7 = buildReportValidationRegistry();
var validateReportValue = (schemaName, value) => {
  if (!Object.hasOwn(REGISTRY7, schemaName)) {
    throw new Error(`report schema '${schemaName}' is not registered in the report-schema registry (fail-closed default)`);
  }
  const schema = REGISTRY7[schemaName];
  const result = schema.safeParse(value);
  if (!result.success) {
    const issueSummary = result.error.issues.map((issue) => {
      const path = issue.path.length > 0 ? issue.path.join(".") : "<root>";
      return `${path}: ${issue.message}`;
    }).join("; ");
    throw new Error(`report body did not validate against schema '${schemaName}' (${issueSummary})`);
  }
};

// dist/runtime/run-files/run-file-store.js
import { mkdir as mkdir5, readFile as readFile5, writeFile as writeFile5 } from "node:fs/promises";
import { dirname as dirname4 } from "node:path";
var RunFileStore = class {
  runDir;
  validateReport;
  constructor(runDir, validateReport) {
    this.runDir = runDir;
    this.validateReport = validateReport;
  }
  resolve(ref) {
    return resolveRunFilePath(this.runDir, typeof ref === "string" ? ref : ref.path);
  }
  async writeJson(ref, value) {
    if (typeof ref !== "string" && ref.schema !== void 0) {
      this.validateReport?.(ref.schema, value);
    }
    const fullPath = this.resolve(ref);
    await mkdir5(dirname4(fullPath), { recursive: true });
    await writeFile5(fullPath, `${JSON.stringify(value, null, 2)}
`, "utf8");
    return fullPath;
  }
  async writeText(ref, value) {
    if (typeof ref !== "string" && ref.schema !== void 0) {
      throw new Error(`writeText cannot write schema-tagged run file '${ref.path}'; use writeJson after parsing and validation`);
    }
    const fullPath = this.resolve(ref);
    await mkdir5(dirname4(fullPath), { recursive: true });
    await writeFile5(fullPath, value, "utf8");
    return fullPath;
  }
  async readJson(ref) {
    const raw = await readFile5(this.resolve(ref), "utf8");
    return JSON.parse(raw);
  }
};

// dist/runtime/run/manifest-snapshot.js
import { mkdir as mkdir6, readFile as readFile6, writeFile as writeFile6 } from "node:fs/promises";
import { dirname as dirname5, join as join9 } from "node:path";
var MANIFEST_SNAPSHOT_RUN_FILE = "manifest.snapshot.json";
function runtimeManifestSnapshotPath(runDir) {
  return join9(runDir, MANIFEST_SNAPSHOT_RUN_FILE);
}
async function writeRuntimeManifestSnapshot(input) {
  const bytes = Buffer.from(input.bytes);
  const snapshot = ManifestSnapshot.parse({
    schema_version: 1,
    run_id: RunId.parse(input.runId),
    flow_id: CompiledFlowId.parse(input.flowId),
    captured_at: input.capturedAt,
    algorithm: "sha256-raw",
    hash: computeManifestHash(bytes),
    bytes_base64: bytes.toString("base64")
  });
  const path = runtimeManifestSnapshotPath(input.runDir);
  await mkdir6(dirname5(path), { recursive: true });
  await writeFile6(path, `${JSON.stringify(snapshot, null, 2)}
`, { encoding: "utf8", flag: "wx" });
  return snapshot;
}
async function readRuntimeManifestSnapshot(runDir) {
  const raw = JSON.parse(await readFile6(runtimeManifestSnapshotPath(runDir), "utf8"));
  return ManifestSnapshot.parse(raw);
}
async function readRuntimeCompiledFlowManifestSnapshot(input) {
  const snapshot = await readRuntimeManifestSnapshot(input.runDir);
  if (input.expectedRunId !== void 0 && snapshot.run_id !== input.expectedRunId) {
    throw new Error(`manifest snapshot run_id mismatch: expected '${input.expectedRunId}' but found '${snapshot.run_id}'`);
  }
  if (input.expectedFlowId !== void 0 && snapshot.flow_id !== input.expectedFlowId) {
    throw new Error(`manifest snapshot flow_id mismatch: expected '${input.expectedFlowId}' but found '${snapshot.flow_id}'`);
  }
  if (input.expectedHash !== void 0 && snapshot.hash !== input.expectedHash) {
    throw new Error(`manifest snapshot hash mismatch: expected '${input.expectedHash}' but found '${snapshot.hash}'`);
  }
  const flowBytes = Buffer.from(snapshot.bytes_base64, "base64");
  let flow;
  try {
    flow = CompiledFlow.parse(JSON.parse(flowBytes.toString("utf8")));
  } catch (error) {
    throw new Error(`manifest snapshot bytes do not parse as CompiledFlow: ${error.message}`);
  }
  if (flow.id !== snapshot.flow_id) {
    throw new Error(`manifest snapshot flow_id '${snapshot.flow_id}' does not match compiled flow id '${flow.id}'`);
  }
  return { snapshot, flowBytes, flow };
}

// dist/runtime/run/result-writer.js
async function writeRuntimeRunResult(files, result) {
  return await files.writeJson(RUN_RESULT_RELATIVE_PATH, result);
}

// dist/runtime/run/graph-runner.js
function isGraphCheckpointWaitingResult(result) {
  return "kind" in result && result.kind === "checkpoint_waiting";
}
var RECOVERY_ROUTE_LABELS = /* @__PURE__ */ new Set(["retry", "revise"]);
function defaultManifestHash(flow) {
  return `runtime:${flow.id}@${flow.version}`;
}
function resultSummary(outcome, terminalTarget) {
  if (terminalTarget === void 0)
    return `Run closed with outcome ${outcome}.`;
  return `Run closed with outcome ${outcome} via ${terminalTarget}.`;
}
function outcomeForTerminal(target) {
  if (target === "@complete")
    return "complete";
  if (target === "@stop")
    return "stopped";
  if (target === "@handoff")
    return "handoff";
  return "escalated";
}
function latestAdmittedVerdict(context) {
  const entries = context.trace.getAll();
  const admitted = /* @__PURE__ */ new Set();
  for (const entry of entries) {
    if (entry.kind === "check.evaluated" && entry.check_kind === "result_verdict" && entry.outcome === "pass" && entry.step_id !== void 0 && entry.attempt !== void 0) {
      admitted.add(`${entry.step_id}:${entry.attempt}`);
    }
  }
  for (const entry of [...entries].reverse()) {
    if (entry.kind !== "relay.completed" && entry.kind !== "sub_run.completed")
      continue;
    if (typeof entry.verdict !== "string" || entry.verdict.length === 0)
      continue;
    if (entry.step_id === void 0 || entry.attempt === void 0)
      continue;
    if (!admitted.has(`${entry.step_id}:${entry.attempt}`))
      continue;
    if (entry.kind === "sub_run.completed" && entry.child_outcome !== "complete")
      continue;
    return entry.verdict;
  }
  return void 0;
}
function isRecoveryRoute(route) {
  return route !== void 0 && RECOVERY_ROUTE_LABELS.has(route);
}
function configuredMaxAttempts(step) {
  const budgets = step.budgets;
  if (budgets === void 0 || budgets === null || typeof budgets !== "object")
    return void 0;
  const maxAttempts = budgets.max_attempts;
  if (typeof maxAttempts !== "number")
    return void 0;
  if (!Number.isInteger(maxAttempts) || maxAttempts < 1)
    return void 0;
  return maxAttempts;
}
function maxAttemptsForRoute(step, route) {
  return configuredMaxAttempts(step) ?? (isRecoveryRoute(route) ? 2 : 1);
}
function bootstrapChangeKind(input) {
  const defaultKind = input.flow.entryModes?.find((mode) => mode.name === input.entryModeName)?.defaultChangeKind ?? "ratchet-advance";
  if (defaultKind !== "ratchet-advance" && defaultKind !== "equivalence-refactor" && defaultKind !== "discovery" && defaultKind !== "disposable") {
    return {
      change_kind: "ratchet-advance",
      failure_mode: "runtime execution cannot produce required reports",
      acceptance_evidence: "trace entries, reports, and result files satisfy their schemas",
      alternate_framing: "start a fresh flow with a narrower goal"
    };
  }
  return {
    change_kind: defaultKind,
    failure_mode: "runtime execution cannot produce required reports",
    acceptance_evidence: "trace entries, reports, and result files satisfy their schemas",
    alternate_framing: "start a fresh flow with a narrower goal"
  };
}
function completedStepCountsFromTrace(entries) {
  const counts = /* @__PURE__ */ new Map();
  for (const entry of entries) {
    if (entry.kind !== "step.completed" || entry.step_id === void 0)
      continue;
    counts.set(entry.step_id, (counts.get(entry.step_id) ?? 0) + 1);
  }
  return counts;
}
async function assertFreshRunDir(runDir) {
  let stat2;
  try {
    stat2 = await lstat(runDir);
  } catch (error) {
    if (error.code !== "ENOENT")
      throw error;
    await mkdir7(runDir, { recursive: true });
    stat2 = await lstat(runDir);
  }
  if (stat2.isSymbolicLink()) {
    throw new Error("runtime baseline requires a fresh run directory; existing path is a symlink");
  }
  if (!stat2.isDirectory()) {
    throw new Error("runtime baseline requires a fresh run directory; existing path is not a directory");
  }
  const entries = await readdir(runDir);
  if (entries.length > 0) {
    throw new Error(`runtime baseline requires a fresh run directory; existing directory is not empty (${entries.join(", ")})`);
  }
}
function resolveManifestHash(flow, options) {
  if (options.manifestBytes === void 0) {
    return options.manifestHash ?? defaultManifestHash(flow);
  }
  const computed = computeManifestHash(options.manifestBytes);
  if (options.manifestHash !== void 0 && options.manifestHash !== computed) {
    throw new Error("manifest bytes hash differs from run manifest_hash");
  }
  return computed;
}
async function closeRun(context, outcome, terminalTarget, reason) {
  await context.trace.append({
    run_id: context.runId,
    kind: "run.closed",
    outcome,
    ...reason === void 0 ? {} : { reason }
  });
  const verdict = outcome === "complete" ? latestAdmittedVerdict(context) : void 0;
  const result = {
    schema_version: 1,
    run_id: context.runId,
    flow_id: context.flow.id,
    goal: context.goal,
    outcome,
    summary: resultSummary(outcome, terminalTarget),
    closed_at: context.now().toISOString(),
    trace_entries_observed: context.trace.getAll().length,
    manifest_hash: context.manifestHash,
    ...reason === void 0 ? {} : { reason },
    ...verdict === void 0 ? {} : { verdict }
  };
  const resultPath2 = await writeRuntimeRunResult(context.files, result);
  return { ...result, resultPath: resultPath2 };
}
async function executeExecutableFlowWithWaiting(flow, options) {
  assertExecutableFlow(flow);
  const isResume = options.resumeCheckpoint !== void 0;
  if (!isResume) {
    await assertFreshRunDir(options.runDir);
  } else {
    await mkdir7(options.runDir, { recursive: true });
  }
  const runId = options.runId ?? randomUUID3();
  const progressProjector = createProgressProjector({
    progress: options.progress,
    runDir: options.runDir,
    runId,
    flow,
    ...options.compiledFlow === void 0 ? {} : { compiledFlow: options.compiledFlow }
  });
  const trace = new TraceStore(options.runDir, {
    ...options.now === void 0 ? {} : { now: options.now },
    onAppend: progressProjector
  });
  const existingTrace = await trace.load();
  if (!isResume && existingTrace.length > 0) {
    throw new Error("runtime baseline requires a fresh run directory");
  }
  if (isResume && existingTrace.length === 0) {
    throw new Error("runtime resume requires an existing trace");
  }
  if (isResume && existingTrace.some((entry) => entry.kind === "run.closed")) {
    throw new Error("runtime resume rejected: run is already closed");
  }
  const files = new RunFileStore(options.runDir, validateReportValue);
  const context = {
    flow,
    ...options.compiledFlow === void 0 ? {} : { compiledFlow: options.compiledFlow },
    runId,
    runDir: options.runDir,
    goal: options.goal ?? `Run ${flow.id}`,
    manifestHash: resolveManifestHash(flow, options),
    ...options.entryModeName === void 0 ? {} : { entryModeName: options.entryModeName },
    ...options.depth === void 0 ? {} : { depth: options.depth },
    now: options.now ?? (() => /* @__PURE__ */ new Date()),
    files,
    trace,
    ...options.childCompiledFlowResolver === void 0 ? {} : { childCompiledFlowResolver: options.childCompiledFlowResolver },
    ...options.childRunner === void 0 ? {} : { childRunner: options.childRunner },
    ...options.childExecutors === void 0 ? {} : { childExecutors: options.childExecutors },
    ...options.projectRoot === void 0 ? {} : { projectRoot: options.projectRoot },
    ...options.evidencePolicy === void 0 ? {} : { evidencePolicy: options.evidencePolicy },
    ...options.worktreeRunner === void 0 ? {} : { worktreeRunner: options.worktreeRunner },
    ...options.relayConnector === void 0 ? {} : { relayConnector: options.relayConnector },
    ...options.relayer === void 0 ? {} : { relayer: options.relayer },
    ...options.selectionConfigLayers === void 0 ? {} : { selectionConfigLayers: options.selectionConfigLayers },
    ...options.progress === void 0 ? {} : { progress: options.progress },
    ...options.resumeCheckpoint === void 0 ? {} : { resumeCheckpoint: options.resumeCheckpoint }
  };
  const executors = {
    ...createDefaultExecutors({
      ...options.relayConnector === void 0 ? {} : { relayConnector: options.relayConnector }
    }),
    ...options.executors
  };
  const steps = new Map(flow.steps.map((step) => [step.id, step]));
  const completedStepCounts = isResume ? completedStepCountsFromTrace(existingTrace) : /* @__PURE__ */ new Map();
  const maxSteps = options.maxSteps ?? Math.max(flow.steps.length * 4, 8);
  const bootstrapRecordedAt = context.now().toISOString();
  if (!isResume && options.manifestBytes !== void 0) {
    await writeRuntimeManifestSnapshot({
      runDir: options.runDir,
      runId,
      flowId: flow.id,
      capturedAt: bootstrapRecordedAt,
      bytes: options.manifestBytes
    });
  }
  if (!isResume) {
    await trace.append({
      run_id: runId,
      kind: "run.bootstrapped",
      recorded_at: bootstrapRecordedAt,
      flow_id: flow.id,
      goal: context.goal,
      manifest_hash: context.manifestHash,
      depth: context.depth ?? "standard",
      change_kind: bootstrapChangeKind({
        flow,
        ...context.entryModeName === void 0 ? {} : { entryModeName: context.entryModeName }
      })
    });
  }
  let currentStepId = options.resumeCheckpoint?.stepId ?? flow.entry;
  let incomingRouteTaken;
  let activeRecovery;
  for (let index = 0; index < maxSteps; index += 1) {
    const step = steps.get(currentStepId);
    if (step === void 0) {
      return await closeRun(context, "aborted", void 0, `route target '${currentStepId}' is not a known step id`);
    }
    const isResumedCheckpoint = options.resumeCheckpoint?.stepId === currentStepId;
    const completedCount = completedStepCounts.get(step.id) ?? 0;
    const maxAttempts = maxAttemptsForRoute(step, incomingRouteTaken);
    const isRecoveryOriginReentry = activeRecovery !== void 0 && activeRecovery.originStepId === step.id && !isRecoveryRoute(incomingRouteTaken);
    const attempt = isResumedCheckpoint ? options.resumeCheckpoint.attempt : completedCount + 1;
    if (!isResumedCheckpoint && completedCount > 0 && !isRecoveryOriginReentry && (!isRecoveryRoute(incomingRouteTaken) || completedCount >= maxAttempts)) {
      const recoverySuffix = activeRecovery?.reason === void 0 ? "" : `; last recovery reason: ${activeRecovery.reason}`;
      const reason = incomingRouteTaken === void 0 ? `route cycle detected at step '${step.id}'; aborting before re-entering an already completed step` : `route '${incomingRouteTaken}' for step '${step.id}' exhausted max_attempts=${maxAttempts}${recoverySuffix}`;
      await trace.append({
        run_id: runId,
        kind: "step.aborted",
        step_id: step.id,
        attempt,
        reason
      });
      return await closeRun(context, "aborted", void 0, reason);
    }
    if (!isResumedCheckpoint) {
      await trace.append({ run_id: runId, kind: "step.entered", step_id: step.id, attempt });
    }
    let route;
    let details;
    try {
      const stepContext = {
        ...context,
        activeStepAttempt: attempt,
        ...isResumedCheckpoint && options.resumeCheckpoint !== void 0 ? { resumeCheckpoint: options.resumeCheckpoint } : {}
      };
      const outcome = await executors[step.kind](step, stepContext);
      if (isWaitingCheckpointStepOutcome(outcome)) {
        return {
          kind: "checkpoint_waiting",
          outcome: "checkpoint_waiting",
          runFolder: options.runDir,
          runId,
          flowId: flow.id,
          traceEntriesObserved: trace.getAll().length,
          checkpoint: outcome.checkpoint
        };
      }
      route = outcome.route;
      details = outcome.details ?? {};
      const recoveryReason = details.reason;
      if (isRecoveryRoute(route) && typeof recoveryReason === "string") {
        activeRecovery = { originStepId: step.id, route, reason: recoveryReason };
      } else if (isRecoveryRoute(route)) {
        activeRecovery = { originStepId: step.id, route };
      }
    } catch (error) {
      const message = error.message;
      await trace.append({
        run_id: runId,
        kind: "step.aborted",
        step_id: step.id,
        attempt,
        reason: message
      });
      return await closeRun(context, "aborted", void 0, `step '${step.id}' handler threw: ${message}`);
    }
    const target = step.routes[route];
    if (target === void 0) {
      const reason = `step '${step.id}' selected undeclared route '${route}'`;
      await trace.append({
        run_id: runId,
        kind: "step.aborted",
        step_id: step.id,
        attempt,
        reason
      });
      return await closeRun(context, "aborted", void 0, reason);
    }
    if (target.kind === "step" && target.stepId === step.id && route === "pass") {
      const reason = `route cycle detected: step '${step.id}' routes via '${route}' to itself`;
      await trace.append({
        run_id: runId,
        kind: "step.aborted",
        step_id: step.id,
        attempt,
        reason
      });
      return await closeRun(context, "aborted", void 0, reason);
    }
    if (target.kind === "step") {
      const targetCompletedCount = completedStepCounts.get(target.stepId) ?? 0;
      const targetStep = steps.get(target.stepId);
      const isRecoveryReturnToOrigin = activeRecovery !== void 0 && activeRecovery.originStepId === target.stepId && !isRecoveryRoute(route);
      const targetMaxAttempts = targetStep === void 0 ? maxAttemptsForRoute(step, route) : maxAttemptsForRoute(targetStep, route);
      if (targetCompletedCount > 0 && !isRecoveryReturnToOrigin && (!isRecoveryRoute(route) || targetCompletedCount >= targetMaxAttempts)) {
        const recoverySuffix = activeRecovery?.reason === void 0 ? "" : `; last recovery reason: ${activeRecovery.reason}`;
        const reason = isRecoveryRoute(route) ? `route '${route}' for step '${target.stepId}' exhausted max_attempts=${targetMaxAttempts}${recoverySuffix}` : `route cycle detected: step '${step.id}' routes via '${route}' to already completed step '${target.stepId}'${recoverySuffix}`;
        await trace.append({
          run_id: runId,
          kind: "step.aborted",
          step_id: step.id,
          attempt,
          reason
        });
        return await closeRun(context, "aborted", void 0, reason);
      }
    }
    if (activeRecovery !== void 0 && activeRecovery.originStepId === step.id && !isRecoveryRoute(route)) {
      activeRecovery = void 0;
    }
    await trace.append({
      run_id: runId,
      kind: "step.completed",
      step_id: step.id,
      attempt,
      route_taken: route
    });
    completedStepCounts.set(step.id, completedCount + 1);
    if (target.kind === "terminal") {
      return await closeRun(context, outcomeForTerminal(target.target), target.target);
    }
    currentStepId = target.stepId;
    incomingRouteTaken = route;
  }
  return await closeRun(context, "aborted", void 0, `maxSteps exceeded: ${maxSteps}`);
}
async function executeExecutableFlow(flow, options) {
  const result = await executeExecutableFlowWithWaiting(flow, options);
  if (isGraphCheckpointWaitingResult(result)) {
    throw new Error(`runtime run '${result.runId}' paused at checkpoint '${result.checkpoint.stepId}', which requires checkpoint-aware resume routing`);
  }
  return result;
}

// dist/runtime/run/compiled-flow-runner.js
function selectEntryMode(flow, entryModeName) {
  if (entryModeName === void 0) {
    const entry2 = flow.entry_modes[0];
    if (entry2 === void 0)
      throw new Error(`compiled flow '${flow.id}' declares no entry modes`);
    return entry2;
  }
  const entry = flow.entry_modes.find((mode) => mode.name === entryModeName);
  if (entry === void 0) {
    throw new Error(`compiled flow '${flow.id}' declares no entry mode named '${entryModeName}'`);
  }
  return entry;
}
function parseCompiledFlowBytes(bytes) {
  const raw = JSON.parse(Buffer.from(bytes).toString("utf8"));
  return CompiledFlow.parse(raw);
}
async function runCompiledFlowWithWaiting(options) {
  const flow = parseCompiledFlowBytes(options.flowBytes);
  const entry = selectEntryMode(flow, options.entryModeName);
  const executable = fromCompiledFlow(flow);
  const depth = options.depth ?? entry.depth;
  return await executeExecutableFlowWithWaiting({
    ...executable,
    entry: entry.start_at,
    metadata: {
      ...executable.metadata,
      selected_entry_mode: entry.name,
      selected_depth: depth
    }
  }, {
    runDir: options.runDir,
    ...options.runId === void 0 ? {} : { runId: options.runId },
    goal: options.goal,
    manifestHash: computeManifestHash(options.flowBytes),
    manifestBytes: options.flowBytes,
    compiledFlow: flow,
    entryModeName: entry.name,
    depth,
    ...options.now === void 0 ? {} : { now: options.now },
    ...options.executors === void 0 ? {} : { executors: options.executors },
    ...options.childExecutors === void 0 ? {} : { childExecutors: options.childExecutors },
    ...options.childCompiledFlowResolver === void 0 ? {} : { childCompiledFlowResolver: options.childCompiledFlowResolver },
    childRunner: options.childRunner ?? runCompiledFlow,
    ...options.projectRoot === void 0 ? {} : { projectRoot: options.projectRoot },
    ...options.evidencePolicy === void 0 ? {} : { evidencePolicy: options.evidencePolicy },
    ...options.worktreeRunner === void 0 ? {} : { worktreeRunner: options.worktreeRunner },
    ...options.relayConnector === void 0 ? {} : { relayConnector: options.relayConnector },
    ...options.relayer === void 0 ? {} : { relayer: options.relayer },
    ...options.selectionConfigLayers === void 0 ? {} : { selectionConfigLayers: options.selectionConfigLayers },
    ...options.progress === void 0 ? {} : { progress: options.progress },
    ...options.maxSteps === void 0 ? {} : { maxSteps: options.maxSteps }
  });
}
async function runCompiledFlow(options) {
  const result = await runCompiledFlowWithWaiting(options);
  if (isGraphCheckpointWaitingResult(result)) {
    throw new Error(`runtime run '${result.runId}' paused at checkpoint '${result.checkpoint.stepId}', which requires checkpoint-aware resume routing`);
  }
  return result;
}

// dist/runtime/run/checkpoint-resume.js
function isRecord2(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
function traceString(entry, key) {
  const value = entry?.[key];
  return typeof value === "string" && value.length > 0 ? value : void 0;
}
function stringArray2(value) {
  if (!Array.isArray(value))
    return void 0;
  const entries = value.filter((entry) => typeof entry === "string");
  return entries.length === value.length && entries.length > 0 ? entries : void 0;
}
function sameStringArray(left, right) {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}
function isRuntimeBootstrap(entry) {
  return entry?.kind === "run.bootstrapped" && traceString(entry, "manifest_hash") !== void 0;
}
async function isRuntimeRunFolder(runDir) {
  try {
    const trace = new TraceStore(runDir);
    const entries = await trace.load();
    return isRuntimeBootstrap(entries[0]);
  } catch {
    return false;
  }
}
function latestUnresolvedCheckpoint(entries) {
  const resolved = /* @__PURE__ */ new Set();
  for (const entry of entries) {
    if (entry.kind !== "checkpoint.resolved" || entry.step_id === void 0)
      continue;
    if (entry.attempt === void 0)
      continue;
    resolved.add(`${entry.step_id}:${entry.attempt}`);
  }
  for (let i = entries.length - 1; i >= 0; i--) {
    const entry = entries[i];
    if (entry === void 0 || entry.kind !== "checkpoint.requested")
      continue;
    if (entry.step_id === void 0 || entry.attempt === void 0)
      continue;
    if (!resolved.has(`${entry.step_id}:${entry.attempt}`))
      return entry;
  }
  throw new Error("runtime checkpoint resume rejected: run has no unresolved checkpoint request");
}
function checkpointStep(input) {
  const step = input.flow.steps.find((candidate) => candidate.id === input.stepId);
  if (step === void 0 || step.kind !== "checkpoint") {
    throw new Error(`runtime checkpoint resume rejected: current step '${input.stepId}' is not a checkpoint`);
  }
  return step;
}
function declaredCheckpointRequestPath(step) {
  const requestPath = step.writes?.request?.path;
  if (requestPath === void 0) {
    throw new Error(`runtime checkpoint resume rejected: checkpoint step '${step.id}' has no declared request path`);
  }
  return requestPath;
}
function readCheckpointRequestContext(input) {
  const requestAbs = resolveRunFilePath(input.runDir, input.requestPath);
  const requestText = readFileSync16(requestAbs, "utf8");
  if (sha256Hex(requestText) !== input.expectedRequestHash) {
    throw new Error("runtime checkpoint resume rejected: checkpoint request hash differs from trace");
  }
  const raw = JSON.parse(requestText);
  if (!isRecord2(raw)) {
    throw new Error(`runtime checkpoint resume rejected: request for '${input.step.id}' is invalid`);
  }
  if (raw.schema_version !== 1 || raw.step_id !== input.step.id) {
    throw new Error(`runtime checkpoint resume rejected: request for '${input.step.id}' is stale`);
  }
  const requestChoices = stringArray2(raw.allowed_choices);
  if (requestChoices === void 0 || requestChoices.length !== input.step.choices.length || requestChoices.some((choice, index) => choice !== input.step.choices[index])) {
    throw new Error(`runtime checkpoint resume rejected: request choices for '${input.step.id}' are stale`);
  }
  const context = raw.execution_context;
  if (!isRecord2(context)) {
    throw new Error(`runtime checkpoint resume rejected: request for '${input.step.id}' has no execution context`);
  }
  const projectRoot = context.project_root;
  if (projectRoot !== void 0 && typeof projectRoot !== "string") {
    throw new Error("runtime checkpoint resume rejected: project_root is invalid");
  }
  const selectionConfigLayers = LayeredConfig.array().parse(context.selection_config_layers ?? []);
  const checkpointReportSha256 = context.checkpoint_report_sha256;
  if (checkpointReportSha256 !== void 0 && typeof checkpointReportSha256 !== "string") {
    throw new Error("runtime checkpoint resume rejected: checkpoint_report_sha256 is invalid");
  }
  return {
    ...projectRoot === void 0 ? {} : { projectRoot },
    selectionConfigLayers,
    ...checkpointReportSha256 === void 0 ? {} : { checkpointReportSha256 }
  };
}
function validateCheckpointReport(input) {
  const report = input.compiledStep.writes.report;
  if (report === void 0) {
    if (input.requestContext.checkpointReportSha256 !== void 0) {
      throw new Error(`runtime checkpoint resume rejected: checkpoint '${input.compiledStep.id}' request carries a report hash but the step writes no report`);
    }
    return;
  }
  if (typeof report === "string") {
    if (input.requestContext.checkpointReportSha256 !== void 0) {
      throw new Error(`runtime checkpoint resume rejected: checkpoint '${input.compiledStep.id}' request carries a report hash but the report has no schema validator`);
    }
    return;
  }
  const builder = findCheckpointBriefBuilder(report.schema);
  if (builder?.validateResumeContext === void 0) {
    if (input.requestContext.checkpointReportSha256 !== void 0) {
      throw new Error(`runtime checkpoint resume rejected: builder for schema '${report.schema}' is missing validateResumeContext but the checkpoint request carries a report hash`);
    }
    return;
  }
  builder.validateResumeContext({
    runFolder: input.runDir,
    step: input.compiledStep,
    reportPath: report.path,
    ...input.requestContext.checkpointReportSha256 === void 0 ? {} : { reportSha256: input.requestContext.checkpointReportSha256 }
  });
}
function executableFlowForResume(input) {
  const executable = fromCompiledFlow(input.flow);
  return {
    ...executable,
    metadata: {
      ...executable.metadata,
      ...traceString(input.bootstrap, "depth") === void 0 ? {} : { selected_depth: traceString(input.bootstrap, "depth") }
    }
  };
}
async function resumeCompiledFlow(options) {
  const trace = new TraceStore(options.runDir, {
    ...options.now === void 0 ? {} : { now: options.now }
  });
  const entries = await trace.load();
  const bootstrap = entries[0];
  if (!isRuntimeBootstrap(bootstrap)) {
    throw new Error("runtime checkpoint resume rejected: run folder is not marked runtime");
  }
  if (entries.some((entry) => entry.kind === "run.closed")) {
    throw new Error("runtime checkpoint resume rejected: run is already closed");
  }
  const bootstrapRunId = traceString(bootstrap, "run_id");
  const bootstrapFlowId = traceString(bootstrap, "flow_id");
  const bootstrapGoal = traceString(bootstrap, "goal");
  const bootstrapManifestHash = traceString(bootstrap, "manifest_hash");
  if (bootstrapRunId === void 0 || bootstrapFlowId === void 0 || bootstrapGoal === void 0 || bootstrapManifestHash === void 0) {
    throw new Error("runtime checkpoint resume rejected: bootstrap identity is incomplete");
  }
  const { flow, flowBytes, snapshot } = await readRuntimeCompiledFlowManifestSnapshot({
    runDir: options.runDir,
    expectedRunId: bootstrapRunId,
    expectedFlowId: bootstrapFlowId,
    expectedHash: bootstrapManifestHash
  });
  const executable = executableFlowForResume({ flow, bootstrap });
  const requested = latestUnresolvedCheckpoint(entries);
  const stepId = traceString(requested, "step_id");
  const attempt = requested.attempt;
  const requestPath = traceString(requested, "request_path");
  const requestHash = traceString(requested, "request_report_hash");
  const allowedChoices = stringArray2(requested.options);
  if (stepId === void 0 || attempt === void 0 || requestPath === void 0 || requestHash === void 0 || allowedChoices === void 0) {
    throw new Error("runtime checkpoint resume rejected: checkpoint request trace is incomplete");
  }
  const step = checkpointStep({ flow: executable, stepId });
  const savedChoices = step.choices;
  if (!sameStringArray(allowedChoices, savedChoices)) {
    throw new Error(`runtime checkpoint resume rejected: checkpoint trace choices for '${stepId}' are stale`);
  }
  if (!savedChoices.includes(options.selection)) {
    throw new Error(`runtime checkpoint resume rejected: selection '${options.selection}' is not allowed for checkpoint '${stepId}'`);
  }
  const compiledStep = flow.steps.find((candidate) => candidate.id === stepId);
  if (compiledStep === void 0 || compiledStep.kind !== "checkpoint") {
    throw new Error(`runtime checkpoint resume rejected: saved flow step '${stepId}' is invalid`);
  }
  const allowed = step.check.allow;
  if (Array.isArray(allowed) && !allowed.includes(options.selection)) {
    throw new Error(`runtime checkpoint resume rejected: selection '${options.selection}' is outside check.allow for checkpoint '${stepId}'`);
  }
  const declaredRequestPath = declaredCheckpointRequestPath(step);
  if (requestPath !== declaredRequestPath) {
    throw new Error(`runtime checkpoint resume rejected: checkpoint request path '${requestPath}' does not match saved flow path '${declaredRequestPath}'`);
  }
  const requestContext = readCheckpointRequestContext({
    runDir: options.runDir,
    step,
    requestPath,
    expectedRequestHash: requestHash
  });
  validateCheckpointReport({
    runDir: options.runDir,
    compiledStep,
    requestContext
  });
  const depth = traceString(bootstrap, "depth");
  const result = await executeExecutableFlow(executable, {
    runDir: options.runDir,
    runId: bootstrapRunId,
    goal: bootstrapGoal,
    manifestHash: snapshot.hash,
    manifestBytes: flowBytes,
    compiledFlow: flow,
    ...depth === void 0 ? {} : { depth },
    ...options.now === void 0 ? {} : { now: options.now },
    ...options.executors === void 0 ? {} : { executors: options.executors },
    ...options.childCompiledFlowResolver === void 0 ? {} : { childCompiledFlowResolver: options.childCompiledFlowResolver },
    childRunner: options.childRunner ?? runCompiledFlow,
    ...requestContext.projectRoot === void 0 ? {} : { projectRoot: requestContext.projectRoot },
    ...options.worktreeRunner === void 0 ? {} : { worktreeRunner: options.worktreeRunner },
    ...options.relayConnector === void 0 ? {} : { relayConnector: options.relayConnector },
    ...options.relayer === void 0 ? {} : { relayer: options.relayer },
    ...requestContext.selectionConfigLayers.length === 0 ? {} : { selectionConfigLayers: requestContext.selectionConfigLayers },
    ...options.progress === void 0 ? {} : { progress: options.progress },
    resumeCheckpoint: { stepId, attempt, selection: options.selection }
  });
  if (isGraphCheckpointWaitingResult(result)) {
    throw new Error("runtime checkpoint resume rejected: resume did not resolve checkpoint");
  }
  return result;
}

// dist/flows/router.js
var ROUTABLE_PACKAGES = buildRoutablePackages(flowPackages);
var DEFAULT_PACKAGE = findDefaultRoutablePackage(ROUTABLE_PACKAGES);
var ROUTABLE_WORKFLOWS = Object.freeze(ROUTABLE_PACKAGES.map((entry) => entry.pkg.id));
var PLANNING_ARTIFACT_SIGNAL = /\b(?:proposal|plan|brief|matrix|evaluation\s+matrix|design\s+doc|design\s+document|spec|specification|rfc|memo|document|doc|guide|analysis|evaluation|selection|strategy|outline|report|comparison|recommendation|write-?up|options|approaches)\b/i;
var QUICK_FIX_SIGNAL = /^\s*(?:(?:quick|small|tiny|simple)\s+fix\s*:|fix\s*:\s*(?:quick|small|tiny|simple)\b)/i;
var DEEP_FIX_SIGNAL = /\b(?:regression|flaky|intermittent|incident|outage|crash|failure|failing\s+(?:test|build)|debug|diagnose|reproduce|root\s+cause)\b/i;
var PLAN_EXECUTION_SIGNAL = /^\s*(?:execute|run|start|begin|work\s+through|carry\s+out|tackle)\s+(?:this\s+|the\s+)?(?:[\w-]+\s+){0,3}(?:plan|backlog|checklist|roadmap|doc|document)(?::|\b)/i;
function classifyPlanExecutionRequest(taskText) {
  if (!PLAN_EXECUTION_SIGNAL.test(taskText))
    return void 0;
  const lower = taskText.toLowerCase();
  if (/\b(?:decide|decision|choose|choice|option|options|tradeoff|trade-off)\b/.test(lower)) {
    return {
      flowName: "explore",
      source: "classifier",
      matched_signal: "plan-execution",
      reason: "matched plan-execution request; selected Explore tournament for a blocking decision",
      inferredEntryModeName: "tournament",
      inferredEntryModeReason: "matched decision-oriented plan execution; selected Explore tournament mode"
    };
  }
  if (/\b(?:migrate|migration|port|rewrite|replace|transition|framework\s+swap)\b/.test(lower)) {
    return {
      flowName: "migrate",
      source: "classifier",
      matched_signal: "plan-execution",
      reason: "matched plan-execution request; selected Migrate for the first migration slice",
      inferredEntryModeName: "deep",
      inferredEntryModeReason: "matched migration-oriented plan execution; selected deep migration thoroughness"
    };
  }
  if (/\b(?:cleanup|clean\s+up|sweep|dead\s+code|quality|coverage|overnight)\b/.test(lower)) {
    const autonomous = /\bovernight\b/.test(lower);
    return {
      flowName: "sweep",
      source: "classifier",
      matched_signal: "plan-execution",
      reason: "matched plan-execution request; selected Sweep for the first cleanup slice",
      inferredEntryModeName: autonomous ? "autonomous" : "default",
      inferredEntryModeReason: autonomous ? "matched overnight plan execution; selected autonomous Sweep thoroughness" : "matched cleanup-oriented plan execution; selected default Sweep thoroughness"
    };
  }
  if (/\b(?:fix|bug|regression|flaky|incident|outage|debug|diagnose|crash|failure)\b/.test(lower)) {
    return {
      flowName: "fix",
      source: "classifier",
      matched_signal: "plan-execution",
      reason: "matched plan-execution request; selected Fix for the first bug-fix slice",
      inferredEntryModeName: "deep",
      inferredEntryModeReason: "matched bug-fix-oriented plan execution; selected deep thoroughness"
    };
  }
  return {
    flowName: "build",
    source: "classifier",
    matched_signal: "plan-execution",
    reason: "matched plan-execution request; selected Build to start the first executable slice",
    inferredEntryModeName: "default",
    inferredEntryModeReason: "matched general plan execution; selected default Build thoroughness"
  };
}
function inferEntryMode(flowName, taskText) {
  if (flowName === "build" && /^\s*develop\s*:/i.test(taskText)) {
    return {
      inferredEntryModeName: "default",
      inferredEntryModeReason: "matched develop intent; selected default Build thoroughness"
    };
  }
  if (flowName === "migrate" && /^\s*migrate\s*:/i.test(taskText)) {
    return {
      inferredEntryModeName: "deep",
      inferredEntryModeReason: "matched migrate intent; selected deep migration thoroughness"
    };
  }
  if (flowName === "sweep") {
    if (/^\s*overnight\s*:/i.test(taskText)) {
      return {
        inferredEntryModeName: "autonomous",
        inferredEntryModeReason: "matched overnight cleanup intent; selected autonomous Sweep thoroughness"
      };
    }
    if (/^\s*cleanup\s*:/i.test(taskText)) {
      return {
        inferredEntryModeName: "default",
        inferredEntryModeReason: "matched cleanup intent; selected default Sweep thoroughness"
      };
    }
  }
  if (flowName === "explore" && /^\s*decide\s*:/i.test(taskText)) {
    return {
      inferredEntryModeName: "tournament",
      inferredEntryModeReason: "matched decide intent; selected Explore tournament mode"
    };
  }
  if (flowName !== "fix")
    return {};
  if (/\bflaky\b/i.test(taskText)) {
    return {
      inferredEntryModeName: "deep",
      inferredEntryModeReason: "matched flaky signal; selected deep thoroughness"
    };
  }
  const deepMatch = taskText.match(DEEP_FIX_SIGNAL);
  if (deepMatch?.[0] !== void 0) {
    return {
      inferredEntryModeName: "deep",
      inferredEntryModeReason: `matched ${deepMatch[0]} signal; selected deep thoroughness`
    };
  }
  if (QUICK_FIX_SIGNAL.test(taskText)) {
    return {
      inferredEntryModeName: "lite",
      inferredEntryModeReason: "matched quick Fix intent; selected lite thoroughness"
    };
  }
  return {};
}
function classifyTaskAgainstRoutables(taskText, routables, defaultPackage) {
  const planExecution = classifyPlanExecutionRequest(taskText);
  if (planExecution !== void 0)
    return planExecution;
  const hasPlanningReport = PLANNING_ARTIFACT_SIGNAL.test(taskText);
  for (const { pkg, routing } of routables) {
    if (routing.isDefault)
      continue;
    for (const signal of routing.signals) {
      if (!signal.pattern.test(taskText))
        continue;
      if (routing.skipOnPlanningReport === true && hasPlanningReport) {
        break;
      }
      return {
        flowName: pkg.id,
        source: "classifier",
        matched_signal: signal.label,
        reason: routing.reasonForMatch(signal),
        ...inferEntryMode(pkg.id, taskText)
      };
    }
  }
  const inferred = inferEntryMode(defaultPackage.pkg.id, taskText);
  return {
    flowName: defaultPackage.pkg.id,
    source: "classifier",
    reason: inferred.inferredEntryModeReason ?? defaultPackage.routing.defaultReason ?? `no signal matched; routed to ${defaultPackage.pkg.id} as the conservative default`,
    ...inferred
  };
}
function classifyCompiledFlowTask(taskText) {
  return classifyTaskAgainstRoutables(taskText, ROUTABLE_PACKAGES, DEFAULT_PACKAGE);
}

// dist/shared/config-loader.js
var import_yaml2 = __toESM(require_dist(), 1);
import { existsSync as existsSync7, readFileSync as readFileSync17 } from "node:fs";
import { homedir as homedir2 } from "node:os";
import { join as join10, resolve as resolve7 } from "node:path";
var USER_GLOBAL_CONFIG_RELATIVE_PATH = [".config", "circuit-next", "config.yaml"];
var PROJECT_CONFIG_RELATIVE_PATH = [".circuit", "config.yaml"];
function userGlobalConfigPath(homeDir = homedir2()) {
  return join10(homeDir, ...USER_GLOBAL_CONFIG_RELATIVE_PATH);
}
function projectConfigPath(cwd = process.cwd()) {
  return join10(cwd, ...PROJECT_CONFIG_RELATIVE_PATH);
}
function parseConfigYaml(text, sourcePath) {
  try {
    return (0, import_yaml2.parse)(text);
  } catch (err) {
    throw new Error(`config YAML parse failed at ${sourcePath}: ${err.message}`);
  }
}
function loadConfigLayerFromPath(layer, sourcePath) {
  const abs = resolve7(sourcePath);
  if (!existsSync7(abs))
    return void 0;
  const raw = parseConfigYaml(readFileSync17(abs, "utf8"), abs);
  try {
    return LayeredConfig.parse({
      layer,
      source_path: abs,
      config: Config.parse(raw)
    });
  } catch (err) {
    throw new Error(`config validation failed for ${layer} at ${abs}: ${err.message}`);
  }
}
function discoverConfigLayers(options = {}) {
  const layers = [];
  const userGlobal = loadConfigLayerFromPath("user-global", userGlobalConfigPath(options.homeDir));
  if (userGlobal !== void 0)
    layers.push(userGlobal);
  const project = loadConfigLayerFromPath("project", projectConfigPath(options.cwd));
  if (project !== void 0)
    layers.push(project);
  if (options.invocationConfig !== void 0) {
    layers.push(LayeredConfig.parse({
      layer: "invocation",
      config: options.invocationConfig
    }));
  }
  return layers;
}

// dist/shared/flow-kind-policy-core.js
var FLOW_KIND_CANONICAL_SETS = {
  explore: {
    canonicals: ["frame", "analyze", "plan", "close"],
    omits: ["act", "verify", "review"],
    optional_canonicals: [],
    variants: [],
    title: "Frame \u2192 Analyze \u2192 Plan or Decision \u2192 Close",
    authority: "src/flows/explore/contract.md \xA7Canonical stage set"
  },
  review: {
    canonicals: ["frame", "analyze", "close"],
    omits: ["plan", "act", "verify", "review"],
    optional_canonicals: [],
    variants: [],
    title: "Intake \u2192 Independent Audit \u2192 Verdict",
    authority: "src/flows/review/contract.md \xA7Canonical stage policy"
  },
  build: {
    canonicals: ["frame", "plan", "act", "verify", "review", "close"],
    omits: ["analyze"],
    optional_canonicals: [],
    variants: [],
    title: "Frame \u2192 Plan \u2192 Act \u2192 Verify \u2192 Review \u2192 Close",
    authority: "src/flows/build/contract.md \xA7Build Flow Contract"
  },
  fix: {
    canonicals: ["frame", "analyze", "act", "verify", "review", "close"],
    omits: ["plan"],
    optional_canonicals: ["review"],
    variants: [],
    title: "Frame \u2192 Diagnose \u2192 Fix \u2192 Verify \u2192 Review \u2192 Close",
    authority: "docs/flows/authoring-model.md \xA7Fix As The Proving Shape"
  }
};
var EXEMPT_FLOW_IDS = /* @__PURE__ */ new Set(["runtime-proof"]);
function objectRecord(value) {
  return value !== null && typeof value === "object" ? value : void 0;
}
function stringStepIdsForCanonical(stages, canonical) {
  const ids = [];
  for (const stage of stages) {
    const p = objectRecord(stage);
    if (p === void 0 || p.canonical !== canonical || !Array.isArray(p.steps))
      continue;
    for (const id of p.steps) {
      if (typeof id === "string")
        ids.push(id);
    }
  }
  return ids;
}
function isReviewResultReportWriter(step) {
  const s = objectRecord(step);
  if (s === void 0 || s.kind !== "compose")
    return false;
  const writes = objectRecord(s.writes);
  const report = objectRecord(writes?.report);
  return report?.schema === "review.result@v1";
}
function isReviewerRelay(step) {
  const s = objectRecord(step);
  return s !== void 0 && s.kind === "relay" && s.role === "reviewer";
}
function declaredCanonicalsFor(fixture) {
  const declared = /* @__PURE__ */ new Set();
  const stages = Array.isArray(fixture.stages) ? fixture.stages : [];
  for (const stage of stages) {
    const stageRecord = objectRecord(stage);
    if (typeof stageRecord?.canonical === "string") {
      declared.add(stageRecord.canonical);
    }
  }
  return declared;
}
function checkCanonicalStagePolicyVariant(id, fixture, variant, optionalCanonicals, authority) {
  const declared = declaredCanonicalsFor(fixture);
  const optional = new Set(optionalCanonicals);
  const required = new Set(variant.canonicals.filter((c) => !optional.has(c)));
  const acceptedDeclared = /* @__PURE__ */ new Set([...required, ...optional]);
  const missing = [...required].filter((c) => !declared.has(c));
  const extra = [...declared].filter((c) => !acceptedDeclared.has(c));
  if (missing.length > 0 || extra.length > 0) {
    const parts = [];
    if (missing.length > 0)
      parts.push(`missing canonical(s): ${missing.join(", ")}`);
    if (extra.length > 0)
      parts.push(`unexpected canonical(s): ${extra.join(", ")}`);
    return {
      ok: false,
      detail: `${id}: canonical stage-set mismatch \u2014 ${parts.join("; ")} (authority: ${authority})`
    };
  }
  const sp = objectRecord(fixture.stage_path_policy);
  if (sp === void 0) {
    return {
      ok: false,
      detail: `${id}: stage_path_policy missing or not an object`
    };
  }
  if (sp.mode !== "partial") {
    return {
      ok: false,
      detail: `${id}: stage_path_policy.mode must be 'partial' for kind-canonical enforcement; got '${String(sp.mode)}'`
    };
  }
  const omits = Array.isArray(sp.omits) ? sp.omits.filter((s) => typeof s === "string") : [];
  const optionalOmitted = [...optional].filter((c) => !declared.has(c));
  const expectedOmits = /* @__PURE__ */ new Set([...variant.omits, ...optionalOmitted]);
  const missingOmits = [...expectedOmits].filter((o) => !omits.includes(o));
  const extraOmits = omits.filter((o) => !expectedOmits.has(o));
  if (missingOmits.length > 0 || extraOmits.length > 0) {
    const parts = [];
    if (missingOmits.length > 0)
      parts.push(`missing omit(s): ${missingOmits.join(", ")}`);
    if (extraOmits.length > 0)
      parts.push(`unexpected omit(s): ${extraOmits.join(", ")}`);
    return {
      ok: false,
      detail: `${id}: stage_path_policy.omits mismatch \u2014 ${parts.join("; ")} (authority: ${authority})`
    };
  }
  return {
    ok: true,
    detail: `${id}: canonical set {${variant.canonicals.join(", ")}} + omits {${variant.omits.join(", ")}} enforced (authority: ${authority})`
  };
}
function checkReviewIdentitySeparationPolicy(fixture) {
  const f = objectRecord(fixture);
  if (f === void 0) {
    return { ok: false, detail: "fixture is not an object" };
  }
  const stages = Array.isArray(f.stages) ? f.stages : [];
  const steps = Array.isArray(f.steps) ? f.steps : [];
  const analyzeStepIds = stringStepIdsForCanonical(stages, "analyze");
  const closeStepIds = stringStepIdsForCanonical(stages, "close");
  const stepsById = /* @__PURE__ */ new Map();
  for (let index = 0; index < steps.length; index++) {
    const step = objectRecord(steps[index]);
    if (typeof step?.id === "string")
      stepsById.set(step.id, { step, index });
  }
  const reviewerRelayIndices = analyzeStepIds.map((id) => stepsById.get(id)).filter((entry) => entry !== void 0 && isReviewerRelay(entry.step)).map((entry) => entry.index);
  if (reviewerRelayIndices.length === 0) {
    return {
      ok: false,
      detail: "analyze stage must contain a relay step with role=reviewer before the close report writer"
    };
  }
  const closeWriterIndices = closeStepIds.map((id) => stepsById.get(id)).filter((entry) => entry !== void 0 && isReviewResultReportWriter(entry.step)).map((entry) => entry.index);
  if (closeWriterIndices.length === 0) {
    return {
      ok: false,
      detail: "close stage must contain a compose step that writes the primary review.result report"
    };
  }
  const everyCloseWriterPreceded = closeWriterIndices.every((closeIndex) => reviewerRelayIndices.some((reviewerIndex) => reviewerIndex < closeIndex));
  if (!everyCloseWriterPreceded) {
    return {
      ok: false,
      detail: "each close-stage review.result report writer must be preceded in steps[] by an analyze-stage reviewer relay"
    };
  }
  return {
    ok: true,
    detail: "close review.result report writer is preceded by an analyze-stage reviewer relay"
  };
}
function checkCompiledFlowKindCanonicalPolicy(fixture) {
  const f = objectRecord(fixture);
  if (f === void 0) {
    return {
      kind: "red",
      detail: "fixture is not an object"
    };
  }
  const id = f.id;
  if (typeof id !== "string") {
    return {
      kind: "red",
      detail: "fixture missing top-level `id` string field"
    };
  }
  if (EXEMPT_FLOW_IDS.has(id)) {
    return {
      kind: "exempt",
      detail: `${id}: exempt from kind-canonical enforcement (partial-stage path, recorded)`
    };
  }
  const expected = FLOW_KIND_CANONICAL_SETS[id];
  if (expected === void 0) {
    return {
      kind: "pass_through",
      detail: `${id}: no canonical-set entry (unknown flow kind; pass-through)`
    };
  }
  const variants = [
    { canonicals: expected.canonicals, omits: expected.omits, title: expected.title },
    ...expected.variants ?? []
  ];
  const checkedVariants = variants.map((variant) => checkCanonicalStagePolicyVariant(id, f, variant, expected.optional_canonicals, expected.authority));
  const acceptedVariant = checkedVariants.find((variant) => variant.ok);
  if (acceptedVariant === void 0) {
    return {
      kind: "red",
      detail: checkedVariants.map((variant) => variant.detail).join(" OR ")
    };
  }
  if (id === "review") {
    const identitySeparation = checkReviewIdentitySeparationPolicy(f);
    if (!identitySeparation.ok) {
      return {
        kind: "red",
        detail: `${id}: ${identitySeparation.detail} (authority: ${expected.authority})`
      };
    }
  }
  return {
    kind: "green",
    detail: acceptedVariant.detail
  };
}

// dist/shared/flow-kind-policy.js
function validateCompiledFlowKindPolicy(flow) {
  const parsed = CompiledFlow.safeParse(flow);
  if (!parsed.success) {
    const issueSummary = parsed.error.issues.slice(0, 5).map((i) => `  ${i.path.join(".") || "<root>"}: ${i.message}`).join("\n");
    const more = parsed.error.issues.length > 5 ? `
  ... +${parsed.error.issues.length - 5} more` : "";
    return {
      ok: false,
      reason: `CompiledFlow.safeParse failed:
${issueSummary}${more}`
    };
  }
  const policyResult = checkCompiledFlowKindCanonicalPolicy(parsed.data);
  if (policyResult.kind === "red") {
    return {
      ok: false,
      reason: `flow-kind canonical policy violation: ${policyResult.detail}`
    };
  }
  return {
    ok: true,
    kind: policyResult.kind,
    detail: policyResult.detail
  };
}

// dist/shared/operator-summary-writer.js
import { existsSync as existsSync9, mkdirSync, readFileSync as readFileSync19, rmSync, writeFileSync } from "node:fs";
import { dirname as dirname6, join as join11 } from "node:path";

// dist/schemas/operator-summary.js
var OperatorSummaryWarning = external_exports.object({
  kind: external_exports.string().min(1),
  message: external_exports.string().min(1),
  path: external_exports.string().min(1).optional()
}).strict();
var OperatorSummaryReportLink = external_exports.object({
  label: external_exports.string().min(1),
  path: external_exports.string().min(1),
  schema: external_exports.string().min(1).optional()
}).strict();
var OperatorBriefSlots = external_exports.object({
  headline: external_exports.string().min(1),
  primary: external_exports.object({
    label: external_exports.string().min(1),
    text: external_exports.string().min(1)
  }).strict(),
  why: external_exports.string().min(1).optional(),
  startWith: external_exports.string().min(1).optional(),
  cautions: external_exports.array(external_exports.string().min(1)),
  nextStep: external_exports.string().min(1).optional()
}).strict();
var OperatorSummary = external_exports.object({
  schema_version: external_exports.literal(1),
  run_id: RunId,
  flow_id: CompiledFlowId,
  selected_flow: CompiledFlowId,
  routed_by: external_exports.enum(["explicit", "classifier"]).optional(),
  router_reason: external_exports.string().min(1).optional(),
  outcome: external_exports.union([RunClosedOutcome, external_exports.literal("checkpoint_waiting")]),
  headline: external_exports.string().min(1),
  status_text: external_exports.string().min(1).max(MAX_STATUS_TEXT_CHARS).optional(),
  brief_slots: OperatorBriefSlots.optional(),
  details: external_exports.array(external_exports.string().min(1)),
  evidence_warnings: external_exports.array(OperatorSummaryWarning),
  run_folder: external_exports.string().min(1),
  result_path: external_exports.string().min(1).optional(),
  html_path: external_exports.string().min(1).optional(),
  report_paths: external_exports.array(OperatorSummaryReportLink),
  checkpoint: external_exports.object({
    step_id: external_exports.string().min(1),
    request_path: external_exports.string().min(1),
    allowed_choices: external_exports.array(external_exports.string().min(1)).min(1)
  }).strict().optional()
}).strict();

// dist/shared/html/page.js
var ESCAPE_MAP = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;"
};
function buildSanitizePattern() {
  const ranges = [
    [0, 8],
    [11, 12],
    [14, 31],
    [8234, 8238],
    [8294, 8297]
  ];
  const klass = ranges.map(([lo, hi]) => {
    const loEsc = `\\u${lo.toString(16).padStart(4, "0")}`;
    const hiEsc = `\\u${hi.toString(16).padStart(4, "0")}`;
    return `${loEsc}-${hiEsc}`;
  }).join("");
  return new RegExp(`[${klass}]`, "g");
}
var SANITIZE_PATTERN = buildSanitizePattern();
var MAX_BULLET_LEN = 4096;
var MAX_PROMPT_LEN = 32768;
function sanitizeForRender(value) {
  return value.replace(SANITIZE_PATTERN, "");
}
function escapeHtmlChars(value) {
  return value.replace(/[&<>"']/g, (char) => ESCAPE_MAP[char] ?? char);
}
function escapeHtml(value) {
  return escapeHtmlChars(sanitizeForRender(value));
}
function truncate(value, max) {
  return value.length > max ? `${value.slice(0, max - 1)}\u2026` : value;
}
function styles() {
  return `:root{--bg:#fafaf9;--surface:#fff;--surface-2:#f5f5f4;--border:#e7e5e4;--border-strong:#d6d3d1;--text:#1c1917;--text-2:#57534e;--text-3:#a8a29e;--accent:#0f172a;--intent-positive:#166534;--intent-positive-soft:#f0fdf4;--intent-info:#1e40af;--intent-info-soft:#eff6ff;--intent-attention:#9a3412;--intent-attention-soft:#fff7ed;--intent-negative:#991b1b;--intent-negative-soft:#fef2f2}@media (prefers-color-scheme:dark){:root{--bg:#0c0a09;--surface:#1c1917;--surface-2:#292524;--border:#292524;--border-strong:#44403c;--text:#fafaf9;--text-2:#a8a29e;--text-3:#78716c;--accent:#fafaf9;--intent-positive:#4ade80;--intent-positive-soft:#052e16;--intent-info:#93c5fd;--intent-info-soft:#172554;--intent-attention:#fb923c;--intent-attention-soft:#431407;--intent-negative:#f87171;--intent-negative-soft:#450a0a}}*{box-sizing:border-box}html,body{margin:0;padding:0}body{font:15px/1.55 -apple-system,BlinkMacSystemFont,"SF Pro Text",system-ui,sans-serif;background:var(--bg);color:var(--text);-webkit-font-smoothing:antialiased}.wrap{max-width:1200px;margin:0 auto;padding:48px 32px 96px}header.top{margin-bottom:24px}.meta{font-size:12px;color:var(--text-3);text-transform:uppercase;letter-spacing:.06em;margin-bottom:8px}h1{font:600 28px/1.25 -apple-system,BlinkMacSystemFont,system-ui,sans-serif;margin:0 0 8px;letter-spacing:-.01em}.subtitle{color:var(--text-2);font-size:16px;margin:0}.verdict{margin:24px 0 32px;padding:16px 20px;background:var(--intent-info-soft);border:1px solid var(--intent-info);border-radius:8px;display:flex;align-items:baseline;gap:12px;flex-wrap:wrap}.verdict.intent-positive{background:var(--intent-positive-soft);border-color:var(--intent-positive)}.verdict.intent-attention{background:var(--intent-attention-soft);border-color:var(--intent-attention)}.verdict.intent-negative{background:var(--intent-negative-soft);border-color:var(--intent-negative)}.verdict .badge{font:600 11px/1 -apple-system,system-ui,sans-serif;letter-spacing:.08em;text-transform:uppercase;color:var(--intent-info);padding:4px 8px;border:1px solid var(--intent-info);border-radius:4px}.verdict.intent-positive .badge{color:var(--intent-positive);border-color:var(--intent-positive)}.verdict.intent-attention .badge{color:var(--intent-attention);border-color:var(--intent-attention)}.verdict.intent-negative .badge{color:var(--intent-negative);border-color:var(--intent-negative)}.verdict .text{color:var(--text);font-size:14px;flex:1;min-width:200px}.verdict .text strong{font-weight:600}.verdict .confidence{font-size:12px;color:var(--text-2);text-transform:lowercase}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:16px}.card{background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:20px;display:flex;flex-direction:column;gap:16px;position:relative}.card.intent-info{border-color:var(--intent-info);box-shadow:0 0 0 3px var(--intent-info-soft)}.card.intent-positive{border-color:var(--intent-positive);box-shadow:0 0 0 3px var(--intent-positive-soft)}.card.intent-attention{border-color:var(--intent-attention);box-shadow:0 0 0 3px var(--intent-attention-soft)}.card.intent-negative{border-color:var(--intent-negative);box-shadow:0 0 0 3px var(--intent-negative-soft)}.card-head{display:flex;justify-content:space-between;align-items:flex-start;gap:12px}.card-id{font:500 11px/1 ui-monospace,"SF Mono",Menlo,monospace;color:var(--text-3);letter-spacing:.05em}.card h2{font:600 17px/1.3 -apple-system,system-ui,sans-serif;margin:4px 0 0;letter-spacing:-.005em}.intent-badge{font:600 10px/1 -apple-system,system-ui,sans-serif;text-transform:uppercase;letter-spacing:.08em;padding:4px 8px;border-radius:4px;white-space:nowrap;color:var(--intent-info);background:var(--intent-info-soft)}.intent-badge.intent-positive{color:var(--intent-positive);background:var(--intent-positive-soft)}.intent-badge.intent-attention{color:var(--intent-attention);background:var(--intent-attention-soft)}.intent-badge.intent-negative{color:var(--intent-negative);background:var(--intent-negative-soft)}.summary{color:var(--text-2);font-size:14px;margin:0}.section-label{font:600 10px/1 -apple-system,system-ui,sans-serif;text-transform:uppercase;letter-spacing:.08em;color:var(--text-3);margin:0 0 8px}ul.tradeoffs{margin:0;padding:0;list-style:none;display:flex;flex-direction:column;gap:6px}ul.tradeoffs li{font-size:13px;color:var(--text);padding-left:18px;position:relative;line-height:1.5}ul.tradeoffs li::before{content:"\\2022";position:absolute;left:6px;color:var(--text-3);font-weight:700}.evidence{display:flex;flex-wrap:wrap;gap:6px}.chip{font:500 11px/1 ui-monospace,"SF Mono",Menlo,monospace;padding:4px 8px;background:var(--surface-2);border:1px solid var(--border);border-radius:4px;color:var(--text-2)}.actions{display:flex;gap:8px;margin-top:auto;padding-top:8px}button.copy{font:500 13px/1 -apple-system,system-ui,sans-serif;padding:8px 12px;border:1px solid var(--border-strong);border-radius:6px;background:var(--surface);color:var(--text);cursor:pointer}button.copy:hover{background:var(--surface-2)}button.copy.primary{background:var(--accent);color:var(--bg);border-color:var(--accent)}button.copy.primary:hover{opacity:.9}details{margin-top:32px;background:var(--surface);border:1px solid var(--border);border-radius:8px;padding:12px 16px}details summary{cursor:pointer;font:500 13px/1.4 -apple-system,system-ui,sans-serif;color:var(--text-2);user-select:none}details[open] summary{margin-bottom:12px}details .body{font-size:13px;color:var(--text-2)}details ul{margin:6px 0;padding-left:20px}details li{margin-bottom:4px}footer{margin-top:48px;padding-top:24px;border-top:1px solid var(--border);color:var(--text-3);font-size:12px;display:flex;justify-content:space-between;flex-wrap:wrap;gap:12px}footer code{font:500 11px/1 ui-monospace,"SF Mono",Menlo,monospace}`;
}
function clipboardScript() {
  return `document.querySelectorAll('button.copy').forEach(btn=>{btn.addEventListener('click',async()=>{const p=btn.dataset.prompt;if(!p)return;try{await navigator.clipboard.writeText(p);const o=btn.textContent;btn.textContent='Copied';setTimeout(()=>{btn.textContent=o;},1200);}catch(e){btn.textContent='Copy failed';}});});`;
}
function renderPage(input) {
  const footerLeft = input.footerLeft === void 0 ? "" : `<span>${escapeHtml(input.footerLeft)}</span>`;
  const footerRight = input.footerRight === void 0 ? "" : `<span><code>${escapeHtml(input.footerRight)}</code></span>`;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(input.title)}</title>
<style>${styles()}</style>
</head>
<body>
<div class="wrap">
  <header class="top">
    <div class="meta">${escapeHtml(input.metaLine)}</div>
    <h1>${escapeHtml(input.headline)}</h1>
    <p class="subtitle">${escapeHtml(input.subtitle)}</p>
  </header>
${input.bodyHtml}
  <footer>
    ${footerLeft}
    ${footerRight}
  </footer>
</div>
<script>${clipboardScript()}</script>
</body>
</html>
`;
}

// dist/shared/html/components.js
function intentClass(intent) {
  return intent === "neutral" || intent === "info" ? "" : `intent-${intent}`;
}
function intentBadge(input) {
  const classes = ["intent-badge"];
  const className = intentClass(input.intent);
  if (className.length > 0)
    classes.push(className);
  return `<span class="${classes.join(" ")}">${escapeHtml(input.text)}</span>`;
}
function chip(text) {
  return `<span class="chip">${escapeHtml(truncate(text, MAX_BULLET_LEN))}</span>`;
}
function card(input) {
  const intent = input.intent ?? "neutral";
  const classes = ["card"];
  const intentClassName = intentClass(intent);
  if (intentClassName.length > 0)
    classes.push(intentClassName);
  const eyebrowMarkup = input.eyebrow === void 0 ? "" : `<div class="card-id">${escapeHtml(input.eyebrow)}</div>`;
  const badgeMarkup = input.badge === void 0 ? "" : intentBadge(input.badge);
  return `    <article class="${classes.join(" ")}">
      <div class="card-head">
        <div>
          ${eyebrowMarkup}
          <h2>${escapeHtml(input.title)}</h2>
        </div>
        ${badgeMarkup}
      </div>
${input.bodyHtml}
    </article>`;
}
function verdictBanner(input) {
  const classes = ["verdict"];
  const intentClassName = intentClass(input.intent);
  if (intentClassName.length > 0)
    classes.push(intentClassName);
  const aside = input.aside === void 0 ? "" : `<span class="confidence">${escapeHtml(input.aside)}</span>`;
  return `  <div class="${classes.join(" ")}">
    <span class="badge">${escapeHtml(input.badgeText)}</span>
    <span class="text">${input.mainHtml}</span>
    ${aside}
  </div>`;
}

// dist/shared/html/explore-tournament.js
function stringField(report, key) {
  const value = report?.[key];
  return typeof value === "string" && value.length > 0 ? value : void 0;
}
function isObject2(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
function verdictBadgeText(verdict) {
  if (verdict === "recommend")
    return "Recommended";
  if (verdict === "no-clear-winner")
    return "No clear winner";
  return "Operator decision";
}
function verdictIntent(verdict) {
  if (verdict === "recommend")
    return "info";
  if (verdict === "no-clear-winner")
    return "attention";
  return "attention";
}
function confidenceText(confidence) {
  return `${confidence} confidence`;
}
function renderOptionCard(option, isRecommended, isSelected) {
  const intent = isSelected ? "positive" : isRecommended ? "info" : "neutral";
  const badge = isSelected ? { text: "Selected", intent: "positive" } : isRecommended ? { text: "Recommended", intent: "info" } : void 0;
  const tradeoffsMarkup = option.tradeoffs.map((tradeoff) => `<li>${escapeHtml(truncate(tradeoff, MAX_BULLET_LEN))}</li>`).join("\n          ");
  const evidenceMarkup = option.evidence_refs.map((ref) => chip(ref)).join("\n          ");
  const bodyHtml = `      <p class="summary">${escapeHtml(option.summary)}</p>
      <div>
        <p class="section-label">Tradeoffs</p>
        <ul class="tradeoffs">
          ${tradeoffsMarkup}
        </ul>
      </div>
      <div>
        <p class="section-label">Evidence</p>
        <div class="evidence">
          ${evidenceMarkup}
        </div>
      </div>
      <div class="actions">
        <button class="copy primary" data-prompt="${escapeHtml(truncate(option.best_case_prompt, MAX_PROMPT_LEN))}">Copy as prompt</button>
      </div>`;
  return card({
    intent,
    eyebrow: option.id,
    title: option.label,
    ...badge === void 0 ? {} : { badge },
    bodyHtml
  });
}
function renderTournamentVerdictBanner(review, decisionOptions, decision2) {
  const recommendedOption = decisionOptions.options.find((option) => option.id === review.recommended_option_id);
  const recommendedLabel = recommendedOption?.label ?? review.recommended_option_id;
  const decisionText = decision2.decision;
  return verdictBanner({
    intent: verdictIntent(review.verdict),
    badgeText: verdictBadgeText(review.verdict),
    mainHtml: `<strong>${escapeHtml(recommendedLabel)}</strong> &mdash; ${escapeHtml(decisionText)}`,
    aside: confidenceText(review.confidence)
  });
}
function renderTournamentDetails(review, decision2) {
  const sections = [];
  sections.push(`<p><strong>Comparison.</strong> ${escapeHtml(review.comparison)}</p>`);
  if (review.objections.length > 0) {
    const items = review.objections.map((item) => `<li>${escapeHtml(truncate(item, MAX_BULLET_LEN))}</li>`).join("");
    sections.push(`<p><strong>Objections.</strong></p><ul>${items}</ul>`);
  }
  if (review.missing_evidence.length > 0) {
    const items = review.missing_evidence.map((item) => `<li>${escapeHtml(truncate(item, MAX_BULLET_LEN))}</li>`).join("");
    sections.push(`<p><strong>Missing evidence.</strong></p><ul>${items}</ul>`);
  }
  if (review.tradeoff_question.length > 0) {
    sections.push(`<p><strong>Tradeoff question.</strong> ${escapeHtml(review.tradeoff_question)}</p>`);
  }
  sections.push(`<p><strong>Rationale.</strong> ${escapeHtml(decision2.rationale)}</p>`);
  if (decision2.residual_risks.length > 0) {
    const items = decision2.residual_risks.map((item) => `<li>${escapeHtml(truncate(item, MAX_BULLET_LEN))}</li>`).join("");
    sections.push(`<p><strong>Residual risks.</strong></p><ul>${items}</ul>`);
  }
  sections.push(`<p><strong>Next action.</strong> ${escapeHtml(decision2.next_action)}</p>`);
  return sections.join("\n      ");
}
function loadHtmlPayload(flowReport, readEvidenceReportById) {
  const snapshot = isObject2(flowReport?.verdict_snapshot) ? flowReport.verdict_snapshot : void 0;
  if (stringField(snapshot, "decision_verdict") !== "decided")
    return void 0;
  const optionsRaw = readEvidenceReportById("explore.decision-options");
  const reviewRaw = readEvidenceReportById("explore.tournament-review");
  const decisionRaw = readEvidenceReportById("explore.decision");
  if (optionsRaw === void 0 || reviewRaw === void 0 || decisionRaw === void 0) {
    return void 0;
  }
  const optionsParsed = ExploreDecisionOptions.safeParse(optionsRaw);
  const reviewParsed = ExploreTournamentReview.safeParse(reviewRaw);
  const decisionParsed = ExploreDecision.safeParse(decisionRaw);
  if (!optionsParsed.success || !reviewParsed.success || !decisionParsed.success)
    return void 0;
  return {
    decisionOptions: optionsParsed.data,
    tournamentReview: reviewParsed.data,
    decision: decisionParsed.data
  };
}
var exploreTournamentProjector = (ctx) => {
  const payload = loadHtmlPayload(ctx.flowReport, ctx.readEvidenceReportById);
  if (payload === void 0)
    return void 0;
  const { decisionOptions, tournamentReview, decision: decision2 } = payload;
  const recommendedId = tournamentReview.recommended_option_id;
  const selectedId = decision2.selected_option_id;
  const subtitle = `${decisionOptions.options.length} options surfaced. Tournament review: ${tournamentReview.verdict.replace(/-/g, " ")} (${tournamentReview.confidence} confidence).`;
  const cards = decisionOptions.options.map((option) => renderOptionCard(option, option.id === recommendedId, option.id === selectedId)).join("\n\n");
  const banner = renderTournamentVerdictBanner(tournamentReview, decisionOptions, decision2);
  const detailsBody = renderTournamentDetails(tournamentReview, decision2);
  const bodyHtml = `${banner}

  <div class="grid">
${cards}
  </div>

  <details>
    <summary>Tournament reasoning &middot; why this recommendation?</summary>
    <div class="body">
      ${detailsBody}
    </div>
  </details>
`;
  return renderPage({
    title: `${decisionOptions.decision_question} \xB7 Circuit Explore`,
    metaLine: `Explore \xB7 ${ctx.flowId} \xB7 ${ctx.runId}`,
    headline: decisionOptions.decision_question,
    subtitle,
    bodyHtml,
    footerLeft: `circuit \xB7 explore \xB7 ${ctx.runId}`,
    footerRight: decisionOptions.recommendation_basis
  });
};

// dist/shared/html/index.js
var HTML_PROJECTORS = {
  explore: exploreTournamentProjector
};

// dist/shared/operator-summary/json.js
import { existsSync as existsSync8, readFileSync as readFileSync18 } from "node:fs";
function isObject3(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
function readJsonIfPresent(runFolder, relPath) {
  const path = resolveRunRelative(runFolder, relPath);
  if (!existsSync8(path))
    return void 0;
  const parsed = JSON.parse(readFileSync18(path, "utf8"));
  return isObject3(parsed) ? parsed : void 0;
}
function stringField2(report, key) {
  const value = report?.[key];
  return typeof value === "string" && value.length > 0 ? value : void 0;
}
function numberField(report, key) {
  const value = report?.[key];
  return typeof value === "number" && Number.isFinite(value) ? value : void 0;
}
function arrayField(report, key) {
  const value = report?.[key];
  return Array.isArray(value) ? value : [];
}
function stringArrayField(report, key) {
  return arrayField(report, key).filter((item) => typeof item === "string");
}
function objectField(report, key) {
  const value = report?.[key];
  return isObject3(value) ? value : void 0;
}
function evidenceReportById(runFolder, flowReport, reportId) {
  for (const item of arrayField(flowReport, "evidence_links")) {
    if (!isObject3(item))
      continue;
    if (stringField2(item, "report_id") !== reportId)
      continue;
    const path = stringField2(item, "path");
    if (path === void 0)
      return void 0;
    try {
      return readJsonIfPresent(runFolder, path);
    } catch {
      return void 0;
    }
  }
  return void 0;
}

// dist/shared/operator-summary/text.js
function plural(count, singular, pluralText = `${singular}s`) {
  return `${count} ${count === 1 ? singular : pluralText}`;
}
function capitalized(value) {
  const first = value[0];
  if (first === void 0)
    return value;
  return `${first.toUpperCase()}${value.slice(1)}`;
}
function sentence(value) {
  return /[.!?]$/.test(value) ? value : `${value}.`;
}
function withoutFinalPunctuation(value) {
  return value.replace(/[.!?]\s*$/, "");
}
function friendlyRunNote(flowId, summary) {
  const match = /^([a-z-]+) v[\d.]+ closed (\d+) step\(s\) for goal ".+"\.$/.exec(summary);
  if (match !== null) {
    return `Completed ${match[2]} ${capitalized(flowId)} steps for this goal.`;
  }
  return summary;
}
function friendlyResultSummary(summary) {
  return summary.replace(/^(?:Build|Fix|Migrate|Review|Explore|Sweep) result for .+?:\s*/, "").replace(/^Explore .+?:\s*/, "");
}
function friendlyReviewStatus(status) {
  if (status === "accept")
    return "accepted";
  if (status === "accept-with-fixes")
    return "requested follow-up fixes";
  if (status === "accept-with-fold-ins")
    return "accepted with follow-up notes";
  if (status === "release-approved")
    return "approved for release";
  if (status === "release-with-followups")
    return "approved with follow-ups";
  if (status === "release-blocked")
    return "blocked from release";
  return status;
}
function friendlyVerificationStatus(status) {
  if (status === "passed")
    return "passed";
  if (status === "failed")
    return "failed";
  return status;
}

// dist/shared/operator-summary/explore.js
var NUMBERED_LABEL_PATTERN = /\(\d+\)\s+([A-Z][^—–()]{1,120}?)\s*[—–]/g;
function stripExplorePrefix(summary) {
  return friendlyResultSummary(summary).trim();
}
function numberedRecommendationLabels(text) {
  const labels = [];
  for (const match of text.matchAll(NUMBERED_LABEL_PATTERN)) {
    const label = match[1]?.trim();
    if (label !== void 0 && label.length > 0)
      labels.push(label);
  }
  return labels;
}
function firstNumberedItemPrefix(text) {
  const match = new RegExp(NUMBERED_LABEL_PATTERN.source).exec(text);
  if (match === null || match.index === void 0)
    return void 0;
  const prefix = text.slice(0, match.index).trim();
  return prefix.length === 0 ? void 0 : prefix;
}
function compactExploreRecommendation(summary) {
  const text = stripExplorePrefix(summary);
  if (text.length === 0)
    return void 0;
  const labels = numberedRecommendationLabels(text);
  if (labels.length > 0) {
    const concretelySplit = text.split(/\s+Concretely:\s+/);
    const intro = concretelySplit.length > 1 ? concretelySplit[0] ?? text : firstNumberedItemPrefix(text) ?? text;
    return `Recommendation: ${withoutFinalPunctuation(intro.trim())}: ${labels.join("; ")}.`;
  }
  const [firstSentence = text] = text.split(/(?<=[.!?])\s+/);
  return `Recommendation: ${sentence(firstSentence.trim())}`;
}
function compactExploreProof(summary) {
  const text = stripExplorePrefix(summary);
  const match = /Before building, the proof needed is:\s*(.*?)(?:\s+Recommend starting|\s+Recommend\s|$)/s.exec(text);
  const raw = match?.[1]?.trim();
  if (raw === void 0 || raw.length === 0)
    return void 0;
  const proof = raw.replace(/\([a-z]\)\s*/gi, "").replace(/\s+/g, " ").replace(/\.\s*$/, "");
  return `Before building: ${proof}.`;
}
function compactExploreStartingPoint(summary) {
  const text = stripExplorePrefix(summary);
  const match = /Recommend starting with\s+(.+?)\./s.exec(text);
  const raw = match?.[1]?.trim();
  return raw === void 0 || raw.length === 0 ? void 0 : `Start with: ${raw}.`;
}
function exploreDecisionReport(runFolder, flowReport) {
  return evidenceReportById(runFolder, flowReport, "explore.decision") ?? readJsonIfPresent(runFolder, "reports/decision.json");
}
function exploreTournamentSnapshot(flowReport) {
  const snapshot = isObject3(flowReport?.verdict_snapshot) ? flowReport.verdict_snapshot : void 0;
  if (stringField2(snapshot, "decision_verdict") === "decided")
    return snapshot;
  return stringField2(snapshot, "selected_option_id") === void 0 ? void 0 : snapshot;
}
function exploreReviewFoldInDetails(flowReport) {
  const foldIns = objectField(flowReport, "review_fold_ins");
  if (foldIns === void 0)
    return [];
  const details = [];
  const objections = stringArrayField(foldIns, "objections");
  const missedAngles = stringArrayField(foldIns, "missed_angles");
  details.push("Reviewer: Accepted the direction, with notes to fold in.");
  for (const objection of objections)
    details.push(`Follow-up: ${objection}`);
  for (const angle of missedAngles)
    details.push(`Follow-up: ${angle}`);
  return details;
}
function exploreGuidanceDetails(flowReport) {
  const summary = stringField2(flowReport, "summary");
  if (summary === void 0)
    return [];
  return [
    compactExploreRecommendation(summary),
    compactExploreProof(summary),
    compactExploreStartingPoint(summary)
  ].filter((detail) => detail !== void 0);
}
var exploreSummaryProjector = ({ runFolder, flowReport, resultSummary: resultSummary2 }) => {
  const verdictSnapshot = isObject3(flowReport?.verdict_snapshot) ? flowReport.verdict_snapshot : void 0;
  const headline = (() => {
    if (exploreTournamentSnapshot(flowReport) !== void 0) {
      const decisionReport = exploreDecisionReport(runFolder, flowReport);
      const selected = stringField2(decisionReport, "selected_option_label") ?? stringField2(verdictSnapshot, "selected_option_id") ?? "selected option";
      const decision2 = stringField2(decisionReport, "decision") ?? stringField2(flowReport, "summary") ?? resultSummary2;
      return `Circuit: Decision made. Selected: ${selected}. ${sentence(decision2)}`;
    }
    const review = stringField2(verdictSnapshot, "review_verdict") ?? "complete";
    return review === "accept-with-fold-ins" ? "Circuit: Recommendation ready. The direction is useful, with follow-up notes." : "Circuit: Recommendation ready. The direction is ready to use.";
  })();
  const details = [
    ...exploreGuidanceDetails(flowReport),
    ...exploreReviewFoldInDetails(flowReport)
  ];
  if (exploreTournamentSnapshot(flowReport) !== void 0) {
    const decisionReport = exploreDecisionReport(runFolder, flowReport);
    const question = stringField2(decisionReport, "decision_question");
    const rationale = stringField2(decisionReport, "rationale");
    const risks = stringArrayField(decisionReport, "residual_risks");
    const nextAction = stringField2(decisionReport, "next_action");
    if (question !== void 0)
      details.push(`Decision question: ${question}`);
    if (rationale !== void 0)
      details.push(`Rationale: ${rationale}`);
    if (risks.length > 0)
      details.push(`Residual risks: ${risks.join("; ")}`);
    if (nextAction !== void 0)
      details.push(`Next action: ${nextAction}`);
  }
  return { headline, details };
};

// dist/shared/operator-summary/projections.js
function flowSummaryDetail(flowReport) {
  const summary = stringField2(flowReport, "summary");
  return summary === void 0 ? void 0 : `Result: ${friendlyResultSummary(summary)}`;
}
function reviewEvidenceDetails(report) {
  const evidenceSummary2 = isObject3(report?.evidence_summary) ? report.evidence_summary : void 0;
  const kind = stringField2(evidenceSummary2, "kind");
  if (kind === "unavailable") {
    const message = stringField2(evidenceSummary2, "message");
    return message === void 0 ? [] : [`Review evidence: unavailable (${message})`];
  }
  if (kind !== "git-working-tree")
    return [];
  const policy2 = stringField2(evidenceSummary2, "untracked_content_policy");
  const count = numberField(evidenceSummary2, "untracked_file_count") ?? 0;
  const sampled = numberField(evidenceSummary2, "untracked_files_sampled") ?? 0;
  const truncated = evidenceSummary2?.untracked_files_truncated === true;
  if (policy2 === "include-content") {
    const suffix = truncated ? "; additional untracked files were not sampled" : "";
    return [
      `Untracked evidence: contents included for ${plural(sampled, "file")} (${plural(count, "untracked file")} found${suffix}).`
    ];
  }
  if (policy2 === "metadata-only" && count > 0) {
    const suffix = truncated ? "; additional untracked files were not sampled" : "";
    return [
      `Untracked evidence: paths and sizes only for ${plural(sampled, "file")} (${plural(count, "untracked file")} found${suffix}).`
    ];
  }
  return [];
}
function hasEvidenceWarningKind(report, kind) {
  return arrayField(report, "evidence_warnings").some((item) => isObject3(item) && stringField2(item, "kind") === kind);
}
var reviewProjector = ({ flowReport }) => {
  const verdict = stringField2(flowReport, "verdict") ?? "review complete";
  const findings = arrayField(flowReport, "findings").length;
  const scopeEmpty = hasEvidenceWarningKind(flowReport, "scope_empty");
  const summaryDetail = flowSummaryDetail(flowReport);
  const details = [];
  if (summaryDetail !== void 0)
    details.push(summaryDetail);
  details.push(`Findings: ${findings}`);
  details.push(...reviewEvidenceDetails(flowReport));
  const headline = scopeEmpty ? `Circuit: Review found no uncommitted changes to examine; committed history (HEAD~1) was not part of this review. Verdict ${verdict} reflects scope, not safety. Findings: ${findings}.` : `Circuit: Review complete. Verdict: ${verdict}. Findings: ${findings}.`;
  return {
    headline,
    details
  };
};
function buildFixMigrateDetails(flowReport) {
  const details = [];
  const summaryDetail = flowSummaryDetail(flowReport);
  if (summaryDetail !== void 0)
    details.push(summaryDetail);
  const verification = stringField2(flowReport, "verification_status");
  const review = stringField2(flowReport, "review_verdict");
  if (verification !== void 0) {
    details.push(`Verification: ${friendlyVerificationStatus(verification)}.`);
  }
  if (review !== void 0) {
    details.push(`Review: ${friendlyReviewStatus(review)}.`);
  }
  return details;
}
function flowOutcomeOrRunFallback(flowReport, runOutcome2) {
  return stringField2(flowReport, "outcome") ?? runOutcome2;
}
var buildProjector = ({ flowReport, runOutcome: runOutcome2 }) => {
  const outcome = flowOutcomeOrRunFallback(flowReport, runOutcome2);
  const verification = stringField2(flowReport, "verification_status") ?? "unknown";
  const review = stringField2(flowReport, "review_verdict") ?? "unknown";
  const headline = (() => {
    if (outcome === "complete" && verification === "passed" && review === "accept") {
      return "Circuit: Build complete. Change implemented, verification passed, review accepted.";
    }
    if (outcome === "needs_attention" && verification === "passed") {
      return "Circuit: Build needs follow-up. Verification passed, but review requested fixes.";
    }
    return `Circuit: Build finished with outcome ${outcome}. Verification: ${friendlyVerificationStatus(verification)}. Review: ${friendlyReviewStatus(review)}.`;
  })();
  return { headline, details: buildFixMigrateDetails(flowReport) };
};
var fixProjector = ({ flowReport, runOutcome: runOutcome2 }) => {
  const outcome = flowOutcomeOrRunFallback(flowReport, runOutcome2);
  const verification = stringField2(flowReport, "verification_status") ?? "unknown";
  const review = stringField2(flowReport, "review_verdict") ?? stringField2(flowReport, "review_status") ?? "unknown";
  return {
    headline: `Circuit: Fix finished with outcome ${outcome}. Verification: ${friendlyVerificationStatus(verification)}. Review: ${friendlyReviewStatus(review)}.`,
    details: buildFixMigrateDetails(flowReport)
  };
};
var migrateProjector = ({ flowReport, runOutcome: runOutcome2 }) => {
  const outcome = flowOutcomeOrRunFallback(flowReport, runOutcome2);
  const verification = stringField2(flowReport, "verification_status") ?? "unknown";
  const review = stringField2(flowReport, "review_verdict") ?? "unknown";
  return {
    headline: `Circuit: Migrate finished with outcome ${outcome}. Verification: ${friendlyVerificationStatus(verification)}. Review: ${friendlyReviewStatus(review)}.`,
    details: buildFixMigrateDetails(flowReport)
  };
};
var sweepProjector = ({ flowReport, runOutcome: runOutcome2 }) => {
  const outcome = flowOutcomeOrRunFallback(flowReport, runOutcome2);
  const deferred = numberField(flowReport, "deferred_count");
  const headline = deferred === void 0 ? `Circuit: Sweep finished with outcome ${outcome}.` : `Circuit: Sweep finished with outcome ${outcome}. Deferred: ${plural(deferred, "item")}.`;
  const summaryDetail = flowSummaryDetail(flowReport);
  return {
    headline,
    details: summaryDetail === void 0 ? [] : [summaryDetail]
  };
};
var defaultProjector = ({ resultSummary: resultSummary2 }) => ({
  headline: resultSummary2,
  details: []
});
var SUMMARY_PROJECTORS = {
  build: buildProjector,
  explore: exploreSummaryProjector,
  fix: fixProjector,
  migrate: migrateProjector,
  review: reviewProjector,
  sweep: sweepProjector
};
function projectSummary(input) {
  const projector = SUMMARY_PROJECTORS[input.flowId] ?? defaultProjector;
  return projector(input);
}

// dist/shared/operator-summary-writer.js
function readPriorRoute(runFolder) {
  const path = join11(runFolder, "reports", "operator-summary.json");
  if (!existsSync9(path))
    return {};
  try {
    const raw = JSON.parse(readFileSync19(path, "utf8"));
    if (!isObject3(raw))
      return {};
    const routedBy = raw.routed_by;
    const routerReason = raw.router_reason;
    return {
      ...routedBy === "explicit" || routedBy === "classifier" ? { routedBy } : {},
      ...typeof routerReason === "string" && routerReason.length > 0 ? { routerReason } : {}
    };
  } catch {
    return {};
  }
}
var FLOW_RESULT_PATHS = {
  build: "reports/build-result.json",
  explore: "reports/explore-result.json",
  fix: "reports/fix-result.json",
  migrate: "reports/migrate-result.json",
  review: "reports/review-result.json",
  sweep: "reports/sweep-result.json"
};
var HTML_REPORT_LABEL = "Operator summary (HTML)";
function jsonPath(runFolder) {
  return join11(runFolder, "reports", "operator-summary.json");
}
function markdownPath(runFolder) {
  return join11(runFolder, "reports", "operator-summary.md");
}
function htmlPath(runFolder) {
  return join11(runFolder, "reports", "operator-summary.html");
}
function reportLink(runFolder, label, relPath, schema) {
  return {
    label,
    path: resolveRunRelative(runFolder, relPath),
    ...schema === void 0 ? {} : { schema }
  };
}
function warningRecords(report) {
  return arrayField(report, "evidence_warnings").flatMap((item) => {
    if (!isObject3(item))
      return [];
    const kind = stringField2(item, "kind");
    const message = stringField2(item, "message");
    if (kind === void 0 || message === void 0)
      return [];
    const path = stringField2(item, "path");
    return [{ kind, message, ...path === void 0 ? {} : { path } }];
  });
}
function evidenceLinks(runFolder, report) {
  return arrayField(report, "evidence_links").flatMap((item) => {
    if (!isObject3(item))
      return [];
    const reportId = stringField2(item, "report_id");
    const path = stringField2(item, "path");
    if (reportId === void 0 || path === void 0)
      return [];
    try {
      return [reportLink(runFolder, reportId, path, stringField2(item, "schema"))];
    } catch {
      return [];
    }
  });
}
function checkpointOptionDetails(runFolder, allowedChoices) {
  const optionsReport = readJsonIfPresent(runFolder, "reports/decision-options.json");
  const labelsById = /* @__PURE__ */ new Map();
  for (const option of arrayField(optionsReport, "options")) {
    if (!isObject3(option))
      continue;
    const id = stringField2(option, "id");
    const label = stringField2(option, "label");
    if (id === void 0 || label === void 0)
      continue;
    labelsById.set(id, label);
  }
  return allowedChoices.flatMap((choice) => {
    const label = labelsById.get(choice);
    return label === void 0 ? [] : [`${label} (${choice})`];
  });
}
function renderMarkdown(summary) {
  const lines = ["Circuit", `\u23BF ${summary.status_text ?? statusTextFromHeadline(summary.headline)}`];
  if (summary.checkpoint !== void 0) {
    lines.push("", "## Checkpoint", "");
    lines.push(`- Step: \`${summary.checkpoint.step_id}\``);
    lines.push(`- Request: ${summary.checkpoint.request_path}`);
    lines.push(`- Choices: ${summary.checkpoint.allowed_choices.join(", ")}`);
  }
  const visibleDetails = summary.details.filter((detail) => !detail.startsWith("Run note:"));
  if (visibleDetails.length > 0) {
    lines.push("");
    for (const detail of visibleDetails)
      lines.push(`- ${detail}`);
  }
  if (summary.evidence_warnings.length > 0) {
    lines.push("", "Warnings:");
    for (const warning of summary.evidence_warnings) {
      const path = warning.path === void 0 ? "" : ` (${warning.path})`;
      lines.push(`- ${warning.kind}${path}: ${warning.message}`);
    }
  }
  if (summary.html_path !== void 0) {
    lines.push("", `Rich summary: ${summary.html_path}`);
  }
  return `${lines.join("\n")}
`;
}
function writeOperatorSummary(input) {
  const flowId = input.runResult.flow_id;
  const flowResultRelPath = FLOW_RESULT_PATHS[flowId];
  const flowReport = flowResultRelPath === void 0 ? void 0 : readJsonIfPresent(input.runFolder, flowResultRelPath);
  const resultRelPath = RUN_RESULT_RELATIVE_PATH;
  const resultPath2 = input.runResult.outcome === "checkpoint_waiting" ? void 0 : resolveRunRelative(input.runFolder, resultRelPath);
  const outJsonPath = jsonPath(input.runFolder);
  const outMarkdownPath = markdownPath(input.runFolder);
  mkdirSync(dirname6(outJsonPath), { recursive: true });
  const projector = HTML_PROJECTORS[flowId];
  const candidateHtmlPath = htmlPath(input.runFolder);
  let outHtmlPath;
  let htmlEmitWarning;
  let renderedHtml;
  if (projector !== void 0) {
    try {
      const ctx = {
        runFolder: input.runFolder,
        runId: input.runResult.run_id,
        flowId,
        flowReport,
        readJsonRunRelative: (relPath) => readJsonIfPresent(input.runFolder, relPath),
        readEvidenceReportById: (reportId) => evidenceReportById(input.runFolder, flowReport, reportId)
      };
      renderedHtml = projector(ctx);
    } catch (err) {
      htmlEmitWarning = {
        kind: "html_render_failed",
        message: err instanceof Error ? err.message : String(err),
        path: candidateHtmlPath
      };
    }
  }
  if (renderedHtml === void 0) {
    if (existsSync9(candidateHtmlPath))
      rmSync(candidateHtmlPath, { force: true, recursive: true });
  } else {
    try {
      writeFileSync(candidateHtmlPath, renderedHtml);
      outHtmlPath = candidateHtmlPath;
    } catch (err) {
      if (existsSync9(candidateHtmlPath))
        rmSync(candidateHtmlPath, { force: true, recursive: true });
      htmlEmitWarning = {
        kind: "html_write_failed",
        message: err instanceof Error ? err.message : String(err),
        path: candidateHtmlPath
      };
    }
  }
  const reportPaths = [];
  if (resultPath2 !== void 0)
    reportPaths.push(reportLink(input.runFolder, "Run result", resultRelPath));
  if (flowResultRelPath !== void 0 && flowReport !== void 0) {
    reportPaths.push(reportLink(input.runFolder, `${flowId} result`, flowResultRelPath));
  }
  if (outHtmlPath !== void 0) {
    reportPaths.push({ label: HTML_REPORT_LABEL, path: outHtmlPath });
  }
  if (input.runResult.outcome === "checkpoint_waiting") {
    const checkpoint = input.runResult.checkpoint;
    reportPaths.push({
      label: "Checkpoint request",
      path: checkpoint.request_path
    });
  }
  reportPaths.push(...evidenceLinks(input.runFolder, flowReport));
  const projection = projectSummary({
    runFolder: input.runFolder,
    flowId,
    flowReport,
    resultSummary: input.runResult.summary,
    runOutcome: input.runResult.outcome
  });
  const details = [
    ...flowMayInvokeWriteCapableWorker(flowId) ? [`Worker access: ${WRITE_CAPABLE_WORKER_DISCLOSURE}`] : [],
    ...flowId === "explore" ? [] : [`Run note: ${friendlyRunNote(flowId, input.runResult.summary)}`],
    ...projection.details
  ];
  if (input.runResult.outcome === "checkpoint_waiting") {
    const checkpoint = input.runResult.checkpoint;
    const optionDetails = checkpointOptionDetails(input.runFolder, checkpoint.allowed_choices);
    if (optionDetails.length > 0)
      details.push(`Checkpoint options: ${optionDetails.join("; ")}`);
  }
  if (input.runResult.outcome === "aborted" && input.runResult.reason !== void 0) {
    details.push(`Abort reason: ${input.runResult.reason}`);
  }
  const headline = input.runResult.outcome === "checkpoint_waiting" ? "Circuit: Waiting for a checkpoint choice." : input.runResult.outcome === "aborted" ? "Circuit: Run aborted." : projection.headline;
  const candidate = OperatorSummary.parse({
    schema_version: 1,
    run_id: input.runResult.run_id,
    flow_id: input.runResult.flow_id,
    selected_flow: input.route.selectedFlow,
    ...input.route.routedBy === void 0 ? {} : { routed_by: input.route.routedBy },
    ...input.route.routerReason === void 0 ? {} : { router_reason: input.route.routerReason },
    outcome: input.runResult.outcome,
    headline,
    status_text: statusTextFromHeadline(headline),
    details,
    evidence_warnings: [
      ...warningRecords(flowReport),
      ...htmlEmitWarning === void 0 ? [] : [htmlEmitWarning]
    ],
    run_folder: input.runFolder,
    ...resultPath2 === void 0 ? {} : { result_path: resultPath2 },
    ...outHtmlPath === void 0 ? {} : { html_path: outHtmlPath },
    report_paths: reportPaths,
    ...input.runResult.outcome === "checkpoint_waiting" ? { checkpoint: input.runResult.checkpoint } : {}
  });
  writeFileSync(outJsonPath, `${JSON.stringify(candidate, null, 2)}
`);
  writeFileSync(outMarkdownPath, renderMarkdown(candidate));
  return outHtmlPath === void 0 ? { summary: candidate, jsonPath: outJsonPath, markdownPath: outMarkdownPath } : {
    summary: candidate,
    jsonPath: outJsonPath,
    markdownPath: outMarkdownPath,
    htmlPath: outHtmlPath
  };
}

// dist/cli/create.js
import { randomUUID as randomUUID5 } from "node:crypto";
import { existsSync as existsSync10, mkdirSync as mkdirSync2, readFileSync as readFileSync21, rmSync as rmSync2, writeFileSync as writeFileSync2 } from "node:fs";
import { homedir as homedir3 } from "node:os";
import { dirname as dirname8, join as join12, resolve as resolve9 } from "node:path";

// dist/cli/runtime-routing-policy.js
import { readFileSync as readFileSync20 } from "node:fs";
import { dirname as dirname7, relative as relative5, resolve as resolve8 } from "node:path";
var GENERATED_FLOW_MIRROR_ROOT_ENV = "CIRCUIT_GENERATED_FLOW_MIRROR_ROOT";
var COMPOSE_WRITER_UNSUPPORTED_REASON = "programmatic composeWriter injections are not supported by the CLI runtime; use executor injection or generated reports";
var RUNTIME_POLICY_REASONS = {
  externalFixtureOrRoot: "explicit --fixture/--flow-root inputs must point at generated flows, trusted generated mirrors, or published custom flows",
  composeWriter: COMPOSE_WRITER_UNSUPPORTED_REASON,
  checkpointResume: "checkpoint resume follows the saved run folder engine marker"
};
var CUSTOM_FLOW_ROOT_RUNTIME_POLICY = "Custom roots created by `circuit-next create` publish a normal runnable flow command.";
var CLI_RUNTIME_ROUTING_POLICY = "Runtime routing: supported flow modes use the runtime by default. Unsupported modes, untrusted fixtures, and programmatic composeWriter injection fail closed. Runtime diagnostics: CIRCUIT_SHOW_RUNTIME_DECISION=1 includes runtime_reason for the selector decision.";
function pathIsInside(parent, child) {
  const rel = relative5(parent, child);
  return rel.length === 0 || !rel.startsWith("..") && !rel.startsWith("/");
}
function fixtureEligibleForRuntime(input) {
  if (input.args.fixturePath === void 0 && input.args.flowRoot === void 0)
    return true;
  const fixturePath = resolve8(input.fixturePath);
  if (pathIsInside(resolve8(input.generatedFlowsRoot ?? "generated/flows"), fixturePath)) {
    return true;
  }
  if (input.args.flowRoot !== void 0 && publishedCustomFlowMatches(input.args.flowRoot, fixturePath)) {
    return true;
  }
  const mirrorRoot = input.generatedFlowMirrorRoot ?? process.env[GENERATED_FLOW_MIRROR_ROOT_ENV];
  if (mirrorRoot === void 0 || mirrorRoot.length === 0 || input.args.flowRoot === void 0) {
    return false;
  }
  const trustedMirrorRoot = resolve8(mirrorRoot);
  return resolve8(input.args.flowRoot) === trustedMirrorRoot && pathIsInside(trustedMirrorRoot, fixturePath);
}
function publishedCustomFlowMatches(flowRoot2, fixturePath) {
  try {
    const manifest = JSON.parse(readFileSync20(resolve8(dirname7(resolve8(flowRoot2)), "manifest.json"), "utf8"));
    if (manifest === null || typeof manifest !== "object" || Array.isArray(manifest))
      return false;
    const customFlows = manifest.custom_flows;
    if (!Array.isArray(customFlows))
      return false;
    return customFlows.some((candidate) => {
      if (candidate === null || typeof candidate !== "object" || Array.isArray(candidate)) {
        return false;
      }
      const flowPath = candidate.flow_path;
      return typeof flowPath === "string" && resolve8(flowPath) === fixturePath;
    });
  } catch {
    return false;
  }
}
function applyFixturePolicy(decision2, input) {
  if (decision2.kind !== "supported")
    return decision2;
  if (fixtureEligibleForRuntime(input))
    return decision2;
  return {
    ...decision2,
    kind: "unsupported",
    reason: RUNTIME_POLICY_REASONS.externalFixtureOrRoot
  };
}
function applyComposeWriterPolicy(decision2, input) {
  if (decision2.kind !== "supported" || !input.hasComposeWriter)
    return decision2;
  return {
    ...decision2,
    kind: "unsupported",
    reason: RUNTIME_POLICY_REASONS.composeWriter
  };
}
function showRuntimeDecision() {
  return process.env.CIRCUIT_SHOW_RUNTIME_DECISION === "1";
}
function runtimeOutputFields(input) {
  if (!input.include)
    return {};
  return {
    runtime_reason: input.decision.reason
  };
}

// dist/cli/utility-progress.js
import { randomUUID as randomUUID4 } from "node:crypto";
function utilityProgress(input) {
  if (!input.enabled)
    return void 0;
  const runId = randomUUID4();
  const flowId = input.flowId;
  const stream = input.stream ?? process.stderr;
  return {
    runId,
    flowId,
    emit(event) {
      const parsed = ProgressEvent.parse({
        schema_version: 1,
        run_id: runId,
        flow_id: flowId,
        ...event
      });
      stream.write(`${JSON.stringify(parsed)}
`);
    }
  };
}

// dist/cli/create.js
var RESERVED_FLOW_IDS = /* @__PURE__ */ new Set([
  "build",
  "explore",
  "fix",
  "handoff",
  "migrate",
  "review",
  "run",
  "sweep"
]);
function usage() {
  return [
    'usage: circuit-next create --description "<flow idea>" [--name <slug>] [--home <path>] [--template-flow-root <path>] [--publish --yes] [--progress jsonl]',
    "",
    "Drafts a user-global custom flow package. Without --publish it only writes a draft; with --publish --yes it promotes the draft into the user-global flow root."
  ].join("\n");
}
function takeValue(argv, index, flag) {
  const next = argv[index + 1];
  if (next === void 0 || next.length === 0)
    throw new Error(`${flag} requires a value`);
  return next;
}
function parseArgs(argv) {
  let name;
  let description;
  let home;
  let templateFlowRoot;
  let publish = false;
  let yes = false;
  let createdAt;
  let progress = false;
  for (let i = 0; i < argv.length; i++) {
    const tok = argv[i];
    if (tok === void 0)
      continue;
    if (tok === "--name") {
      name = takeValue(argv, i, tok);
      i += 1;
      continue;
    }
    if (tok === "--description") {
      description = takeValue(argv, i, tok);
      i += 1;
      continue;
    }
    if (tok === "--home") {
      home = takeValue(argv, i, tok);
      i += 1;
      continue;
    }
    if (tok === "--template-flow-root") {
      templateFlowRoot = takeValue(argv, i, tok);
      i += 1;
      continue;
    }
    if (tok === "--created-at") {
      createdAt = takeValue(argv, i, tok);
      i += 1;
      continue;
    }
    if (tok === "--publish") {
      publish = true;
      continue;
    }
    if (tok === "--yes") {
      yes = true;
      continue;
    }
    if (tok === "--progress") {
      const value = takeValue(argv, i, tok);
      if (value !== "jsonl")
        throw new Error("--progress only supports 'jsonl'");
      progress = true;
      i += 1;
      continue;
    }
    if (tok === "--help" || tok === "-h") {
      process.stdout.write(`${usage()}
`);
      process.exit(0);
    }
    throw new Error(tok.startsWith("--") ? `unknown flag: ${tok}` : `unexpected argument: ${tok}`);
  }
  return {
    publish,
    yes,
    progress,
    ...name === void 0 ? {} : { name },
    ...description === void 0 ? {} : { description },
    ...home === void 0 ? {} : { home },
    ...templateFlowRoot === void 0 ? {} : { templateFlowRoot },
    ...createdAt === void 0 ? {} : { createdAt }
  };
}
function slugify(value) {
  const slug = value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 48).replace(/-+$/g, "");
  return slug.length > 0 ? slug : `custom-${randomUUID5().slice(0, 8)}`;
}
function assertValidSlug(slug) {
  if (!/^[a-z][a-z0-9-]*$/.test(slug)) {
    throw new Error(`custom flow name must be lowercase kebab-case: ${slug}`);
  }
  if (RESERVED_FLOW_IDS.has(slug)) {
    throw new Error(`custom flow name '${slug}' is reserved by Circuit`);
  }
}
function customHome(args) {
  return resolve9(args.home ?? join12(homedir3(), ".config", "circuit-next", "custom"));
}
function draftRoot(home, slug) {
  return join12(home, "drafts", slug);
}
function publishedRoot(home, slug) {
  return join12(home, "skills", slug);
}
function flowRoot(home) {
  return join12(home, "flows");
}
function customFlowInvocation(slug, home) {
  return `circuit-next run ${slug} --flow-root '${flowRoot(home)}' --goal '<task>' --progress jsonl`;
}
function commandRoot(home) {
  return join12(home, "commands");
}
function reportsRoot(home) {
  return join12(home, "reports");
}
function manifestPath(home) {
  return join12(home, "manifest.json");
}
function resultPath(home, slug) {
  return join12(reportsRoot(home), `${slug}-create-result.json`);
}
function summaryPath(home, slug) {
  return join12(reportsRoot(home), `${slug}-operator-summary.md`);
}
function writeText(path, text) {
  mkdirSync2(dirname8(path), { recursive: true });
  writeFileSync2(path, text.endsWith("\n") ? text : `${text}
`);
}
function writeJson(path, value) {
  writeText(path, JSON.stringify(value, null, 2));
}
function validateCustomFlow(slug, flow, source) {
  if (flow.id !== slug) {
    throw new Error(`custom flow draft id '${flow.id}' does not match expected name '${slug}'`);
  }
  const policy2 = validateCompiledFlowKindPolicy(flow);
  if (!policy2.ok) {
    throw new Error(`${source} validation failed: ${policy2.reason}`);
  }
}
function candidateTemplatePaths(args) {
  const roots = [args.templateFlowRoot, "generated/flows", "plugins/circuit/flows"].filter((root) => root !== void 0);
  return roots.map((root) => resolve9(root, "build", "circuit.json"));
}
function loadTemplateFlow(args) {
  for (const candidate of candidateTemplatePaths(args)) {
    if (!existsSync10(candidate))
      continue;
    return CompiledFlow.parse(JSON.parse(readFileSync21(candidate, "utf8")));
  }
  throw new Error("could not find the Build template flow; pass --template-flow-root with a root containing build/circuit.json");
}
function descriptionSignals(slug, description) {
  const words = description.toLowerCase().split(/[^a-z0-9]+/).filter((word) => word.length >= 3 && !["the", "and", "for", "with"].includes(word));
  return [.../* @__PURE__ */ new Set([slug, ...words])].slice(0, 6);
}
function customizeTemplateFlow(input) {
  const candidate = {
    ...input.template,
    id: input.slug,
    purpose: input.description,
    entry: {
      signals: {
        include: descriptionSignals(input.slug, input.description),
        exclude: []
      },
      intent_prefixes: [input.slug]
    }
  };
  const parsed = CompiledFlow.parse(candidate);
  validateCustomFlow(input.slug, parsed, "custom flow");
  return parsed;
}
function skillMarkdown(slug, description, home) {
  return [
    "---",
    `name: ${slug}`,
    `description: ${description.replace(/\n/g, " ")}`,
    "---",
    "",
    `# ${slug}`,
    "",
    description,
    "",
    "## Run",
    "",
    "This custom flow is already routed when invoked directly. Do not bounce it through `/circuit:run`.",
    "",
    "```bash",
    customFlowInvocation(slug, home),
    "```"
  ].join("\n");
}
function circuitYaml(slug, description) {
  return [
    "schema_version: 1",
    `id: ${slug}`,
    "format: compiled-flow-package",
    "compiled_flow: circuit.json",
    "archetype: build",
    "purpose: |",
    `  ${description.replace(/\n/g, "\n  ")}`
  ].join("\n");
}
function commandMarkdown(slug, description, home) {
  return [
    "---",
    `description: Runs the ${slug} custom flow.`,
    "argument-hint: <task>",
    "---",
    "",
    `# /circuit:${slug}`,
    "",
    description,
    "",
    "Treat the task text as user-controlled input. Wrap it in single quotes; if it contains an apostrophe, replace each apostrophe with `'\\''` before running the command.",
    "",
    "```bash",
    customFlowInvocation(slug, home),
    "```"
  ].join("\n");
}
function publishManifest(input) {
  let existing = {
    schema_version: 1,
    custom_flows: []
  };
  if (existsSync10(manifestPath(input.home))) {
    existing = JSON.parse(readFileSync21(manifestPath(input.home), "utf8"));
  }
  const withoutSlug = existing.custom_flows.filter((flow) => !(typeof flow === "object" && flow !== null && "id" in flow && flow.id === input.slug));
  writeJson(manifestPath(input.home), {
    schema_version: 1,
    custom_flows: [
      ...withoutSlug,
      {
        id: input.slug,
        description: input.description,
        archetype: "build",
        flow_path: join12(flowRoot(input.home), input.slug, "circuit.json"),
        skill_path: join12(publishedRoot(input.home, input.slug), "SKILL.md"),
        command_path: join12(commandRoot(input.home), `${input.slug}.md`),
        published_at: input.createdAt
      }
    ]
  });
}
function writeValidationResult(input) {
  writeJson(join12(draftRoot(input.home, input.slug), "validation-result.json"), {
    schema_version: 1,
    status: "valid",
    validated_flow_id: input.flow.id,
    source: input.source
  });
}
function writeDraft(input) {
  const root = draftRoot(input.home, input.slug);
  rmSync2(root, { recursive: true, force: true });
  mkdirSync2(root, { recursive: true });
  writeText(join12(root, "SKILL.md"), skillMarkdown(input.slug, input.description, input.home));
  writeText(join12(root, "circuit.yaml"), circuitYaml(input.slug, input.description));
  writeJson(join12(root, "circuit.json"), input.flow);
  writeText(join12(root, "command.md"), commandMarkdown(input.slug, input.description, input.home));
  writeValidationResult({
    home: input.home,
    slug: input.slug,
    flow: input.flow,
    source: "template"
  });
}
function loadDraftFlow(home, slug) {
  const path = join12(draftRoot(home, slug), "circuit.json");
  const flow = CompiledFlow.parse(JSON.parse(readFileSync21(path, "utf8")));
  validateCustomFlow(slug, flow, "custom flow draft");
  return flow;
}
function publishDraft(input) {
  const draft = draftRoot(input.home, input.slug);
  if (!existsSync10(join12(draft, "SKILL.md"))) {
    throw new Error(`draft missing for ${input.slug}: ${draft}`);
  }
  const skillRoot = publishedRoot(input.home, input.slug);
  const customFlowRoot = join12(flowRoot(input.home), input.slug);
  mkdirSync2(skillRoot, { recursive: true });
  mkdirSync2(customFlowRoot, { recursive: true });
  writeText(join12(skillRoot, "SKILL.md"), readFileSync21(join12(draft, "SKILL.md"), "utf8"));
  writeText(join12(skillRoot, "circuit.yaml"), readFileSync21(join12(draft, "circuit.yaml"), "utf8"));
  writeText(join12(customFlowRoot, "circuit.json"), readFileSync21(join12(draft, "circuit.json"), "utf8"));
  writeText(join12(commandRoot(input.home), `${input.slug}.md`), readFileSync21(join12(draft, "command.md"), "utf8"));
  publishManifest(input);
}
function summaryMarkdown(input) {
  const invocation = customFlowInvocation(input.slug, input.home);
  return [
    "# Circuit Create",
    "",
    `Status: ${input.status}`,
    `Custom flow: ${input.slug}`,
    "",
    "## Purpose",
    input.description,
    "",
    "## Validation",
    "The generated compiled flow parsed successfully and passed flow-kind policy validation.",
    "",
    "## Runtime Policy",
    CUSTOM_FLOW_ROOT_RUNTIME_POLICY,
    "",
    "## Usage",
    `\`${invocation}\``,
    "",
    "## Next Action",
    input.status === "published" ? "Run the usage command above, or reload the host command surface if your host caches slash commands." : "Review the draft, then rerun create with `--publish --yes` when ready."
  ].join("\n");
}
async function runCreateCommand(argv, options = {}) {
  let args;
  try {
    args = parseArgs(argv);
  } catch (err) {
    process.stderr.write(`error: ${err.message}
`);
    return 2;
  }
  const now = options.now ?? (() => /* @__PURE__ */ new Date());
  const progress = utilityProgress({ enabled: args.progress, flowId: "create", now });
  if (progress !== void 0) {
    progress.emit({
      type: "route.selected",
      recorded_at: now().toISOString(),
      label: "Selected Create",
      display: {
        text: "Circuit selected create.",
        importance: "major",
        tone: "info"
      },
      presentation: progressPresentation({ blockId: progress.runId, statusText: "Chose create." }),
      selected_flow: "create",
      routed_by: "explicit",
      router_reason: "explicit create utility command"
    });
  }
  try {
    if (args.description === void 0 || args.description.length === 0) {
      throw new Error("--description is required");
    }
    if (args.publish && !args.yes) {
      throw new Error("--publish requires --yes so publish confirmation is explicit");
    }
    const slug = slugify(args.name ?? args.description);
    assertValidSlug(slug);
    const home = customHome(args);
    if (args.publish && existsSync10(join12(flowRoot(home), slug, "circuit.json"))) {
      throw new Error(`custom flow already published: ${slug}`);
    }
    const createdAt = args.createdAt ?? now().toISOString();
    const draftExists = existsSync10(join12(draftRoot(home, slug), "circuit.json"));
    const flow = args.publish && draftExists ? loadDraftFlow(home, slug) : customizeTemplateFlow({
      slug,
      description: args.description,
      template: loadTemplateFlow(args)
    });
    const outputDescription = args.publish && draftExists ? flow.purpose : args.description;
    if (args.publish && draftExists) {
      writeValidationResult({ home, slug, flow, source: "draft" });
    } else {
      writeDraft({ home, slug, description: outputDescription, flow });
    }
    const status = args.publish ? "published" : "draft_created";
    if (args.publish) {
      publishDraft({ home, slug, description: outputDescription, createdAt });
    }
    const summary = summaryMarkdown({ slug, description: outputDescription, status, home });
    writeText(summaryPath(home, slug), summary);
    const result = {
      schema_version: 1,
      action: "create",
      status,
      slug,
      draft_path: draftRoot(home, slug),
      validation_path: join12(draftRoot(home, slug), "validation-result.json"),
      ...args.publish ? {
        published_path: publishedRoot(home, slug),
        flow_path: join12(flowRoot(home), slug, "circuit.json"),
        command_path: join12(commandRoot(home), `${slug}.md`),
        manifest_path: manifestPath(home)
      } : {},
      operator_summary_markdown_path: summaryPath(home, slug)
    };
    const outPath = resultPath(home, slug);
    writeJson(outPath, result);
    const finalResult = { ...result, result_path: outPath };
    if (progress !== void 0) {
      progress.emit({
        type: "run.completed",
        recorded_at: now().toISOString(),
        label: "Create completed",
        display: {
          text: `Circuit create ${status === "published" ? "published" : "drafted"} ${slug}.`,
          importance: "major",
          tone: "success"
        },
        presentation: progressPresentation({
          blockId: progress.runId,
          statusText: `Create ${status === "published" ? "published" : "drafted"} ${slug}.`
        }),
        outcome: "complete",
        result_path: outPath
      });
    }
    process.stdout.write(`${JSON.stringify(finalResult, null, 2)}
`);
    return 0;
  } catch (err) {
    process.stderr.write(`error: ${err instanceof Error ? err.message : String(err)}
`);
    return 1;
  }
}

// dist/cli/handoff.js
import { randomUUID as randomUUID6 } from "node:crypto";
import { copyFileSync, existsSync as existsSync12, mkdirSync as mkdirSync3, readFileSync as readFileSync24, writeFileSync as writeFileSync4 } from "node:fs";
import { homedir as homedir4 } from "node:os";
import { dirname as dirname9, join as join16, resolve as resolve11 } from "node:path";
import { fileURLToPath } from "node:url";

// dist/run-status/project-run-folder.js
import { constants, accessSync, statSync } from "node:fs";
import { resolve as resolve10 } from "node:path";

// dist/shared/manifest-snapshot.js
import { readFileSync as readFileSync22, writeFileSync as writeFileSync3 } from "node:fs";
import { join as join13 } from "node:path";
function manifestSnapshotPath(runFolder) {
  return join13(runFolder, "manifest.snapshot.json");
}
function readManifestSnapshot(runFolder) {
  const text = readFileSync22(manifestSnapshotPath(runFolder), "utf8");
  const raw = JSON.parse(text);
  return ManifestSnapshot.parse(raw);
}
function verifyManifestSnapshotBytes(runFolder) {
  return readManifestSnapshot(runFolder);
}

// dist/run-status/projection-common.js
import { existsSync as existsSync11 } from "node:fs";
import { join as join14 } from "node:path";

// dist/schemas/run-status.js
var RunStatusEngineState = external_exports.enum([
  "open",
  "waiting_checkpoint",
  "completed",
  "aborted",
  "invalid"
]);
var RunStatusValidReason = external_exports.enum([
  "active_or_unknown",
  "checkpoint_waiting",
  "run_closed"
]);
var RunStatusInvalidReason = external_exports.enum([
  "manifest_invalid",
  "trace_invalid",
  "identity_mismatch",
  "checkpoint_invalid",
  "unknown"
]);
var RunStatusAction = external_exports.enum(["inspect", "resume", "none"]);
var CurrentStepStatus = external_exports.object({
  step_id: StepId,
  attempt: external_exports.number().int().positive().optional(),
  stage_id: StageId.optional(),
  label: external_exports.string().min(1).optional()
}).strict();
var CheckpointChoiceStatus = external_exports.object({
  id: external_exports.string().min(1),
  label: external_exports.string().min(1),
  value: external_exports.string().min(1)
}).strict();
var WaitingCheckpointStatus = external_exports.object({
  checkpoint_id: external_exports.string().min(1),
  step_id: StepId,
  attempt: external_exports.number().int().positive(),
  prompt: external_exports.string().min(1).optional(),
  choices: external_exports.array(CheckpointChoiceStatus).min(1),
  request_path: external_exports.string().min(1).optional()
}).strict();
var LastRunStatusEvent = external_exports.object({
  sequence: external_exports.number().int().nonnegative(),
  type: external_exports.string().min(1),
  timestamp: external_exports.string().datetime()
}).strict();
var RunStatusError = external_exports.object({
  code: external_exports.string().min(1),
  message: external_exports.string().min(1)
}).strict();
var ValidRunStatusBase = external_exports.object({
  api_version: external_exports.literal("run-status-v1"),
  schema_version: external_exports.literal(1),
  run_folder: external_exports.string().min(1),
  run_id: RunId,
  flow_id: CompiledFlowId,
  goal: external_exports.string().min(1),
  last_event: LastRunStatusEvent.optional(),
  operator_summary_path: external_exports.string().min(1).optional(),
  operator_summary_markdown_path: external_exports.string().min(1).optional(),
  result_path: external_exports.string().min(1).optional()
}).strict();
var OpenRunStatusProjectionV1 = ValidRunStatusBase.extend({
  engine_state: external_exports.literal("open"),
  reason: external_exports.literal("active_or_unknown"),
  legal_next_actions: external_exports.tuple([external_exports.literal("inspect")]),
  current_step: CurrentStepStatus.optional()
}).strict();
var WaitingCheckpointRunStatusProjectionV1 = ValidRunStatusBase.extend({
  engine_state: external_exports.literal("waiting_checkpoint"),
  reason: external_exports.literal("checkpoint_waiting"),
  legal_next_actions: external_exports.tuple([external_exports.literal("inspect"), external_exports.literal("resume")]),
  current_step: CurrentStepStatus.optional(),
  checkpoint: WaitingCheckpointStatus
}).strict();
var CompletedRunStatusProjectionV1 = ValidRunStatusBase.extend({
  engine_state: external_exports.literal("completed"),
  reason: external_exports.literal("run_closed"),
  legal_next_actions: external_exports.tuple([external_exports.literal("inspect")]),
  terminal_outcome: RunClosedOutcome.exclude(["aborted"])
}).strict();
var AbortedRunStatusProjectionV1 = ValidRunStatusBase.extend({
  engine_state: external_exports.literal("aborted"),
  reason: external_exports.literal("run_closed"),
  legal_next_actions: external_exports.tuple([external_exports.literal("inspect")]),
  terminal_outcome: external_exports.literal("aborted")
}).strict();
var InvalidRunStatusProjectionV1 = external_exports.object({
  api_version: external_exports.literal("run-status-v1"),
  schema_version: external_exports.literal(1),
  run_folder: external_exports.string().min(1),
  engine_state: external_exports.literal("invalid"),
  reason: RunStatusInvalidReason,
  legal_next_actions: external_exports.tuple([external_exports.literal("none")]),
  error: RunStatusError,
  run_id: RunId.optional(),
  flow_id: CompiledFlowId.optional(),
  goal: external_exports.string().min(1).optional()
}).strict();
var RunStatusProjectionV1 = external_exports.discriminatedUnion("engine_state", [
  OpenRunStatusProjectionV1,
  WaitingCheckpointRunStatusProjectionV1,
  CompletedRunStatusProjectionV1,
  AbortedRunStatusProjectionV1,
  InvalidRunStatusProjectionV1
]);
var EngineErrorCodeV1 = external_exports.enum([
  "invalid_invocation",
  "folder_not_found",
  "folder_unreadable",
  "internal_error"
]);
var EngineErrorV1 = external_exports.object({
  api_version: external_exports.literal("engine-error-v1"),
  schema_version: external_exports.literal(1),
  error: external_exports.object({
    code: EngineErrorCodeV1,
    message: external_exports.string().min(1)
  }).strict(),
  run_folder: external_exports.string().min(1).optional()
}).strict();

// dist/run-status/projection-common.js
function errorMessage2(err) {
  return err instanceof Error ? err.message : String(err);
}
function invalidProjection(input) {
  return RunStatusProjectionV1.parse({
    api_version: "run-status-v1",
    schema_version: 1,
    run_folder: input.runFolder,
    engine_state: "invalid",
    reason: input.reason,
    legal_next_actions: ["none"],
    error: {
      code: input.code,
      message: input.message
    },
    ...input.bootstrap === void 0 ? {} : { goal: input.bootstrap.goal },
    ...input.manifestIdentity === void 0 ? input.bootstrap === void 0 ? {} : { run_id: input.bootstrap.run_id, flow_id: input.bootstrap.flow_id } : { run_id: input.manifestIdentity.run_id, flow_id: input.manifestIdentity.flow_id }
  });
}
function readSavedFlowForProjection(manifestBytesBase64, manifestFlowId) {
  try {
    const text = Buffer.from(manifestBytesBase64, "base64").toString("utf8");
    const flow = CompiledFlow.parse(JSON.parse(text));
    const parsedFlowId = flow.id;
    if (parsedFlowId !== manifestFlowId) {
      return { kind: "identity_mismatch", parsedFlowId };
    }
    return { kind: "available", flow };
  } catch {
    return { kind: "unavailable" };
  }
}
function optionalReportPaths(runFolder) {
  const result = runResultPath(runFolder);
  const operatorSummary = join14(runFolder, "reports", "operator-summary.json");
  const operatorSummaryMarkdown = join14(runFolder, "reports", "operator-summary.md");
  return {
    ...existsSync11(result) ? { result_path: result } : {},
    ...existsSync11(operatorSummary) ? { operator_summary_path: operatorSummary } : {},
    ...existsSync11(operatorSummaryMarkdown) ? { operator_summary_markdown_path: operatorSummaryMarkdown } : {}
  };
}
function stepMetadata(flow, stepId) {
  if (flow === void 0)
    return {};
  const step = flow.steps.find((candidate) => candidate.id === stepId);
  const stage = flow.stages.find((candidate) => candidate.steps.some((candidateStepId) => candidateStepId === stepId));
  return {
    ...stage === void 0 ? {} : { stage_id: stage.id },
    ...step === void 0 ? {} : { label: step.title }
  };
}

// dist/run-status/runtime-run-folder.js
import { readFileSync as readFileSync23 } from "node:fs";
import { join as join15 } from "node:path";
function isRecord3(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
function readRawTraceEntries(runFolder) {
  const tracePath = join15(runFolder, "trace.ndjson");
  const text = readFileSync23(tracePath, "utf8");
  const trimmed = text.trim();
  if (trimmed.length === 0)
    return [];
  const entries = trimmed.split("\n").map((line, index) => {
    const parsed = JSON.parse(line);
    if (!isRecord3(parsed)) {
      throw new Error("trace entry is not a JSON object");
    }
    const entry = TraceEntry.parse(parsed);
    if (entry.sequence !== index) {
      throw new Error(`trace sequence mismatch at entry ${index}`);
    }
    return entry;
  });
  const closedIndex = entries.findIndex((entry) => entry.kind === "run.closed");
  if (closedIndex !== -1 && closedIndex !== entries.length - 1) {
    throw new Error(`trace entry after run.closed at sequence ${closedIndex}`);
  }
  return entries;
}
function traceString2(entry, key) {
  const value = entry[key];
  return typeof value === "string" && value.length > 0 ? value : void 0;
}
function traceNumber(entry, key) {
  const value = entry[key];
  return typeof value === "number" && Number.isFinite(value) ? value : void 0;
}
function traceStringArray(entry, key) {
  const value = entry[key];
  if (!Array.isArray(value))
    return void 0;
  const entries = value.filter((item) => typeof item === "string");
  return entries.length === value.length && entries.length > 0 ? entries : void 0;
}
function stringArray3(value) {
  if (!Array.isArray(value))
    return void 0;
  const entries = value.filter((item) => typeof item === "string");
  return entries.length === value.length && entries.length > 0 ? entries : void 0;
}
function sameStringArray2(left, right) {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}
function isRuntimeTrace(log) {
  const bootstrap = log[0];
  return bootstrap !== void 0 && bootstrap.kind === "run.bootstrapped" && bootstrap.schema_version === 1 && isRecord3(bootstrap.change_kind) && traceString2(bootstrap, "manifest_hash") !== void 0;
}
function runtimeLastEvent(log) {
  const entry = log[log.length - 1];
  if (entry === void 0) {
    throw new Error("runtime trace unexpectedly had no final trace entry");
  }
  const sequence = traceNumber(entry, "sequence");
  const kind = traceString2(entry, "kind");
  const recordedAt = traceString2(entry, "recorded_at");
  if (sequence === void 0 || kind === void 0 || recordedAt === void 0) {
    throw new Error("runtime trace final event is missing sequence, kind, or recorded_at");
  }
  return {
    sequence,
    type: kind,
    timestamp: recordedAt
  };
}
function runtimeRunOutcome(entry) {
  const outcome = traceString2(entry, "outcome");
  if (outcome === "complete" || outcome === "aborted" || outcome === "handoff" || outcome === "stopped" || outcome === "escalated") {
    return outcome;
  }
  return void 0;
}
function runtimeCurrentStepProjection(log, flow) {
  const completed = /* @__PURE__ */ new Set();
  for (const entry of log) {
    if (entry.kind !== "step.completed" && entry.kind !== "step.aborted")
      continue;
    const stepId = traceString2(entry, "step_id");
    const attempt = traceNumber(entry, "attempt");
    if (stepId !== void 0 && attempt !== void 0)
      completed.add(`${stepId}:${attempt}`);
  }
  for (let i = log.length - 1; i >= 0; i--) {
    const entry = log[i];
    if (entry === void 0 || entry.kind !== "step.entered")
      continue;
    const stepId = traceString2(entry, "step_id");
    const attempt = traceNumber(entry, "attempt");
    if (stepId === void 0 || attempt === void 0 || completed.has(`${stepId}:${attempt}`)) {
      continue;
    }
    return {
      step_id: stepId,
      attempt,
      ...stepMetadata(flow, stepId)
    };
  }
  return void 0;
}
function latestUnresolvedRuntimeCheckpoint(log) {
  const resolved = /* @__PURE__ */ new Set();
  for (const entry of log) {
    if (entry.kind !== "checkpoint.resolved")
      continue;
    const stepId = traceString2(entry, "step_id");
    const attempt = traceNumber(entry, "attempt");
    if (stepId !== void 0 && attempt !== void 0)
      resolved.add(`${stepId}:${attempt}`);
  }
  for (let i = log.length - 1; i >= 0; i--) {
    const entry = log[i];
    if (entry === void 0 || entry.kind !== "checkpoint.requested")
      continue;
    const stepId = traceString2(entry, "step_id");
    const attempt = traceNumber(entry, "attempt");
    if (stepId === void 0 || attempt === void 0)
      continue;
    if (!resolved.has(`${stepId}:${attempt}`))
      return entry;
  }
  return void 0;
}
function runtimeWaitingCheckpointProjection(input) {
  const requested = latestUnresolvedRuntimeCheckpoint(input.log);
  if (requested === void 0)
    return void 0;
  const stepId = traceString2(requested, "step_id");
  const attempt = traceNumber(requested, "attempt");
  const requestPath = traceString2(requested, "request_path");
  const expectedHash = traceString2(requested, "request_report_hash");
  const allowedChoices = traceStringArray(requested, "options");
  if (stepId === void 0 || attempt === void 0 || requestPath === void 0 || expectedHash === void 0 || allowedChoices === void 0) {
    return invalidProjection({
      runFolder: input.runFolder,
      reason: "checkpoint_invalid",
      code: "checkpoint_trace_incomplete",
      message: "runtime checkpoint.requested trace entry is missing resume fields",
      manifestIdentity: input.manifestIdentity
    });
  }
  const flow = input.flow;
  if (flow === void 0) {
    return invalidProjection({
      runFolder: input.runFolder,
      reason: "checkpoint_invalid",
      code: "checkpoint_flow_unavailable",
      message: "saved flow bytes are unavailable for runtime checkpoint projection",
      manifestIdentity: input.manifestIdentity
    });
  }
  const step = flow.steps.find((candidate) => candidate.id === stepId);
  if (step === void 0 || step.kind !== "checkpoint") {
    return invalidProjection({
      runFolder: input.runFolder,
      reason: "checkpoint_invalid",
      code: "checkpoint_step_missing",
      message: `saved flow does not contain checkpoint step '${stepId}'`,
      manifestIdentity: input.manifestIdentity
    });
  }
  const declaredRequestPath = step.writes.request;
  if (requestPath !== declaredRequestPath) {
    return invalidProjection({
      runFolder: input.runFolder,
      reason: "checkpoint_invalid",
      code: "checkpoint_request_path_mismatch",
      message: `runtime checkpoint request path '${requestPath}' does not match saved flow path '${declaredRequestPath}'`,
      manifestIdentity: input.manifestIdentity
    });
  }
  const savedChoices = step.policy.choices.map((choice) => choice.id);
  if (!sameStringArray2(allowedChoices, savedChoices)) {
    return invalidProjection({
      runFolder: input.runFolder,
      reason: "checkpoint_invalid",
      code: "checkpoint_choice_mismatch",
      message: `runtime checkpoint trace choices for '${stepId}' do not match saved flow choices`,
      manifestIdentity: input.manifestIdentity
    });
  }
  let requestText;
  let requestAbs;
  try {
    requestAbs = resolveRunFilePath(input.runFolder, requestPath);
    requestText = readFileSync23(requestAbs, "utf8");
  } catch (err) {
    return invalidProjection({
      runFolder: input.runFolder,
      reason: "checkpoint_invalid",
      code: "checkpoint_request_unreadable",
      message: `runtime checkpoint request is missing or unreadable (${errorMessage2(err)})`,
      manifestIdentity: input.manifestIdentity
    });
  }
  if (sha256Hex(requestText) !== expectedHash) {
    return invalidProjection({
      runFolder: input.runFolder,
      reason: "checkpoint_invalid",
      code: "checkpoint_request_hash_mismatch",
      message: "runtime checkpoint request hash differs from trace",
      manifestIdentity: input.manifestIdentity
    });
  }
  let requestRecord;
  try {
    const parsed = JSON.parse(requestText);
    if (!isRecord3(parsed))
      throw new Error("request is not a JSON object");
    requestRecord = parsed;
  } catch (err) {
    return invalidProjection({
      runFolder: input.runFolder,
      reason: "checkpoint_invalid",
      code: "checkpoint_request_invalid_json",
      message: `runtime checkpoint request is invalid (${errorMessage2(err)})`,
      manifestIdentity: input.manifestIdentity
    });
  }
  if (requestRecord.schema_version !== 1 || requestRecord.step_id !== stepId) {
    return invalidProjection({
      runFolder: input.runFolder,
      reason: "checkpoint_invalid",
      code: "checkpoint_request_stale",
      message: `runtime checkpoint request for '${stepId}' is stale`,
      manifestIdentity: input.manifestIdentity
    });
  }
  const requestChoices = stringArray3(requestRecord.allowed_choices);
  if (requestChoices === void 0 || !sameStringArray2(requestChoices, savedChoices)) {
    return invalidProjection({
      runFolder: input.runFolder,
      reason: "checkpoint_invalid",
      code: "checkpoint_choice_mismatch",
      message: `runtime checkpoint request choices for '${stepId}' do not match saved flow choices`,
      manifestIdentity: input.manifestIdentity
    });
  }
  const prompt = typeof requestRecord.prompt === "string" ? requestRecord.prompt : void 0;
  const policyChoiceLabels = new Map(step.policy.choices.map((choice) => [
    choice.id,
    choice.label ?? choice.id
  ]));
  const presentation = tournamentCheckpointPresentation({
    runDir: input.runFolder,
    allowedChoices: requestChoices,
    fallbackPrompt: prompt ?? "Choose how to continue this checkpoint.",
    fallbackLabel: (choice) => policyChoiceLabels.get(choice) ?? choice,
    fallbackDescription: (choice) => `Resume with '${choice}'.`
  });
  const choices = presentation.choices.map((choice) => ({
    id: choice.id,
    label: choice.label,
    value: choice.id
  }));
  return RunStatusProjectionV1.parse({
    api_version: "run-status-v1",
    schema_version: 1,
    run_folder: input.runFolder,
    engine_state: "waiting_checkpoint",
    reason: "checkpoint_waiting",
    legal_next_actions: ["inspect", "resume"],
    run_id: input.bootstrapRunId,
    flow_id: input.bootstrapFlowId,
    goal: input.bootstrapGoal,
    current_step: {
      step_id: stepId,
      attempt,
      ...stepMetadata(flow, stepId)
    },
    checkpoint: {
      checkpoint_id: `${stepId}:${attempt}`,
      step_id: stepId,
      attempt,
      prompt: presentation.prompt,
      choices,
      request_path: requestAbs
    },
    last_event: input.event,
    ...input.reportPaths
  });
}
function projectRuntimeRunStatusFromRunFolder(runFolder, manifest) {
  let log;
  try {
    log = readRawTraceEntries(runFolder);
  } catch {
    return void 0;
  }
  if (!isRuntimeTrace(log))
    return void 0;
  const bootstrap = log[0];
  if (bootstrap === void 0) {
    return invalidProjection({
      runFolder,
      reason: "trace_invalid",
      code: "trace_bootstrap_missing",
      message: "runtime trace is missing its run.bootstrapped entry",
      manifestIdentity: {
        run_id: manifest.run_id,
        flow_id: manifest.flow_id
      }
    });
  }
  const bootstrapRunId = traceString2(bootstrap, "run_id");
  const bootstrapFlowId = traceString2(bootstrap, "flow_id");
  const bootstrapManifestHash = traceString2(bootstrap, "manifest_hash");
  const bootstrapGoal = traceString2(bootstrap, "goal");
  if (bootstrapRunId === void 0 || bootstrapFlowId === void 0 || bootstrapManifestHash === void 0 || bootstrapGoal === void 0) {
    return invalidProjection({
      runFolder,
      reason: "trace_invalid",
      code: "trace_bootstrap_incomplete",
      message: "runtime trace run.bootstrapped entry is missing identity or goal fields",
      manifestIdentity: {
        run_id: manifest.run_id,
        flow_id: manifest.flow_id
      }
    });
  }
  if (bootstrapRunId !== manifest.run_id || bootstrapFlowId !== manifest.flow_id || bootstrapManifestHash !== manifest.hash) {
    return invalidProjection({
      runFolder,
      reason: "identity_mismatch",
      code: "identity_mismatch",
      message: "manifest snapshot does not match the runtime bootstrapped trace identity",
      manifestIdentity: {
        run_id: manifest.run_id,
        flow_id: manifest.flow_id
      }
    });
  }
  const savedFlow = readSavedFlowForProjection(manifest.bytes_base64, manifest.flow_id);
  const flow = savedFlow.kind === "available" ? savedFlow.flow : void 0;
  const reportPaths = optionalReportPaths(runFolder);
  let event;
  try {
    event = runtimeLastEvent(log);
  } catch (err) {
    return invalidProjection({
      runFolder,
      reason: "trace_invalid",
      code: "trace_last_event_invalid",
      message: `runtime trace final event is invalid (${errorMessage2(err)})`,
      manifestIdentity: {
        run_id: manifest.run_id,
        flow_id: manifest.flow_id
      }
    });
  }
  const terminal = log[log.length - 1];
  if (terminal?.kind === "run.closed") {
    const outcome = runtimeRunOutcome(terminal);
    if (outcome === void 0) {
      return invalidProjection({
        runFolder,
        reason: "trace_invalid",
        code: "trace_terminal_outcome_invalid",
        message: "runtime run.closed trace entry is missing a valid outcome",
        manifestIdentity: {
          run_id: manifest.run_id,
          flow_id: manifest.flow_id
        }
      });
    }
    const base = {
      api_version: "run-status-v1",
      schema_version: 1,
      run_folder: runFolder,
      run_id: bootstrapRunId,
      flow_id: bootstrapFlowId,
      goal: bootstrapGoal,
      reason: "run_closed",
      legal_next_actions: ["inspect"],
      terminal_outcome: outcome,
      last_event: event,
      ...reportPaths
    };
    return RunStatusProjectionV1.parse(outcome === "aborted" ? { ...base, engine_state: "aborted" } : { ...base, engine_state: "completed" });
  }
  const waiting = runtimeWaitingCheckpointProjection({
    runFolder,
    log,
    flow,
    bootstrapRunId,
    bootstrapFlowId,
    bootstrapGoal,
    event,
    reportPaths,
    manifestIdentity: {
      run_id: manifest.run_id,
      flow_id: manifest.flow_id
    }
  });
  if (waiting !== void 0)
    return waiting;
  return RunStatusProjectionV1.parse({
    api_version: "run-status-v1",
    schema_version: 1,
    run_folder: runFolder,
    engine_state: "open",
    reason: "active_or_unknown",
    legal_next_actions: ["inspect"],
    run_id: bootstrapRunId,
    flow_id: bootstrapFlowId,
    goal: bootstrapGoal,
    current_step: runtimeCurrentStepProjection(log, flow),
    last_event: event,
    ...reportPaths
  });
}

// dist/run-status/project-run-folder.js
var RunStatusFolderError = class extends Error {
  code;
  runFolder;
  constructor(code, runFolder, message) {
    super(message);
    this.name = "RunStatusFolderError";
    this.code = code;
    this.runFolder = runFolder;
  }
};
function assertReadableRunFolder(runFolder) {
  let stat2;
  try {
    stat2 = statSync(runFolder);
  } catch (err) {
    const nodeCode = err.code;
    if (nodeCode === "ENOENT" || nodeCode === "ENOTDIR") {
      throw new RunStatusFolderError("folder_not_found", runFolder, `run folder does not exist: ${runFolder}`);
    }
    throw new RunStatusFolderError("folder_unreadable", runFolder, `run folder is unreadable: ${runFolder} (${errorMessage2(err)})`);
  }
  if (!stat2.isDirectory()) {
    throw new RunStatusFolderError("folder_unreadable", runFolder, `run folder is not a directory: ${runFolder}`);
  }
  try {
    accessSync(runFolder, constants.R_OK | constants.X_OK);
  } catch (err) {
    throw new RunStatusFolderError("folder_unreadable", runFolder, `run folder is unreadable: ${runFolder} (${errorMessage2(err)})`);
  }
}
function projectRunStatusFromRunFolder(runFolder) {
  const resolvedRunFolder = resolve10(runFolder);
  assertReadableRunFolder(resolvedRunFolder);
  let manifest;
  try {
    manifest = verifyManifestSnapshotBytes(resolvedRunFolder);
  } catch (err) {
    return invalidProjection({
      runFolder: resolvedRunFolder,
      reason: "manifest_invalid",
      code: "manifest_invalid",
      message: `manifest snapshot is missing or invalid (${errorMessage2(err)})`
    });
  }
  const runtimeProjection = projectRuntimeRunStatusFromRunFolder(resolvedRunFolder, manifest);
  if (runtimeProjection !== void 0)
    return runtimeProjection;
  return invalidProjection({
    runFolder: resolvedRunFolder,
    reason: "trace_invalid",
    code: "trace_bootstrap_invalid",
    message: "trace is missing or invalid for this run folder",
    manifestIdentity: {
      run_id: manifest.run_id,
      flow_id: manifest.flow_id
    }
  });
}

// dist/schemas/snapshot.js
var StepStatus = external_exports.enum(["pending", "in_progress", "check_failed", "complete", "aborted"]);
var StepState = external_exports.object({
  step_id: StepId,
  status: StepStatus,
  attempts: external_exports.number().int().nonnegative(),
  last_report_path: external_exports.string().optional(),
  last_checkpoint_selection: external_exports.string().optional(),
  last_route_taken: external_exports.string().optional()
}).strict();
var SnapshotStatus = external_exports.enum([
  "in_progress",
  "complete",
  "aborted",
  "handoff",
  "stopped",
  "escalated"
]);
var Snapshot = external_exports.object({
  schema_version: external_exports.literal(1),
  run_id: RunId,
  flow_id: CompiledFlowId,
  invocation_id: InvocationId.optional(),
  depth: Depth,
  change_kind: ChangeKindDeclaration,
  current_step: StepId.optional(),
  status: SnapshotStatus,
  steps: external_exports.array(StepState),
  trace_entries_consumed: external_exports.number().int().nonnegative(),
  manifest_hash: external_exports.string().min(1),
  updated_at: external_exports.string().datetime()
}).strict();

// dist/schemas/continuity.js
var GitState = external_exports.object({
  cwd: external_exports.string().min(1),
  branch: external_exports.string().optional(),
  head: external_exports.string().optional(),
  base_commit: external_exports.string().optional()
}).strict();
var ContinuityNarrative = external_exports.object({
  goal: external_exports.string().min(1),
  next: external_exports.string().min(1),
  state_markdown: external_exports.string().min(1),
  debt_markdown: external_exports.string().min(1)
}).strict();
var RunAttachedProvenance = external_exports.object({
  run_id: RunId,
  invocation_id: InvocationId.optional(),
  current_stage: StageId,
  current_step: StepId,
  runtime_status: SnapshotStatus,
  runtime_updated_at: external_exports.string().datetime()
}).strict();
var resumeContractRefine = (v) => v.auto_resume !== v.requires_explicit_resume;
var resumeContractRefineMessage = {
  message: "auto_resume and requires_explicit_resume are contradictory: exactly one must be true"
};
var StandaloneResumeContract = external_exports.object({
  mode: external_exports.literal("resume_standalone"),
  auto_resume: external_exports.boolean(),
  requires_explicit_resume: external_exports.boolean()
}).strict().refine(resumeContractRefine, resumeContractRefineMessage);
var RunBackedResumeContract = external_exports.object({
  mode: external_exports.literal("resume_run"),
  auto_resume: external_exports.boolean(),
  requires_explicit_resume: external_exports.boolean()
}).strict().refine(resumeContractRefine, resumeContractRefineMessage);
var ContinuityBase = external_exports.object({
  schema_version: external_exports.literal(1),
  record_id: ControlPlaneFileStem,
  project_root: external_exports.string().min(1),
  created_at: external_exports.string().datetime(),
  git: GitState,
  narrative: ContinuityNarrative
});
var StandaloneContinuity = ContinuityBase.extend({
  continuity_kind: external_exports.literal("standalone"),
  resume_contract: StandaloneResumeContract
}).strict();
var RunBackedContinuity = ContinuityBase.extend({
  continuity_kind: external_exports.literal("run-backed"),
  run_ref: RunAttachedProvenance,
  resume_contract: RunBackedResumeContract
}).strict();
var recordOwnPropertyGuard = external_exports.custom((raw) => {
  if (raw === null || typeof raw !== "object")
    return true;
  const guarded = ["schema_version", "record_id", "continuity_kind", "resume_contract"];
  for (const f of guarded)
    if (!Object.hasOwn(raw, f))
      return false;
  return true;
}, "continuity record has inherited (not own) identity/discriminator field; prototype-chain smuggle rejected");
var ContinuityRecord = recordOwnPropertyGuard.pipe(external_exports.discriminatedUnion("continuity_kind", [StandaloneContinuity, RunBackedContinuity]));
var PendingRecordPointer = external_exports.object({
  record_id: ControlPlaneFileStem,
  continuity_kind: external_exports.union([external_exports.literal("standalone"), external_exports.literal("run-backed")]),
  created_at: external_exports.string().datetime()
}).strict();
var AttachedRunPointer = external_exports.object({
  run_id: RunId,
  current_stage: StageId,
  current_step: StepId,
  runtime_status: SnapshotStatus,
  attached_at: external_exports.string().datetime(),
  last_validated_at: external_exports.string().datetime()
}).strict();
var ContinuityIndexBody = external_exports.object({
  schema_version: external_exports.literal(1),
  project_root: external_exports.string().min(1),
  pending_record: PendingRecordPointer.nullable(),
  current_run: AttachedRunPointer.nullable()
}).strict();
var indexOwnPropertyGuard = external_exports.custom((raw) => {
  if (raw === null || typeof raw !== "object")
    return true;
  const guarded = ["schema_version", "project_root", "pending_record", "current_run"];
  for (const f of guarded)
    if (!Object.hasOwn(raw, f))
      return false;
  return true;
}, "continuity index has inherited (not own) required field; prototype-chain smuggle rejected");
var ContinuityIndex = indexOwnPropertyGuard.pipe(ContinuityIndexBody);

// dist/cli/handoff.js
var DEFAULT_CONTROL_PLANE = ".circuit-next";
var HANDOFF_BRIEF_API_VERSION = "handoff-brief-v1";
var HANDOFF_BRIEF_SCHEMA_VERSION = 1;
var HANDOFF_BRIEF_MAX_CHARS = 3e3;
var HANDOFF_HOOKS_API_VERSION = "handoff-hooks-v1";
var HANDOFF_HOOKS_SCHEMA_VERSION = 1;
var CIRCUIT_HOOK_MARKER = "CIRCUIT_HANDOFF_HOOK=1";
function usage2() {
  return [
    'usage: circuit-next handoff [save] --goal "<goal>" --next "<next>" [--state-markdown <md>] [--debt-markdown <md>] [--run-folder <path>] [--control-plane <path>] [--record-id <stem>] [--progress jsonl]',
    "       circuit-next handoff resume [--control-plane <path>] [--progress jsonl]",
    "       circuit-next handoff done [--control-plane <path>] [--progress jsonl]",
    "       circuit-next handoff brief --json [--control-plane <path>] [--project-root <path>]",
    "       circuit-next handoff hook --host codex [--project-root <path>]",
    "       circuit-next handoff hooks install|uninstall|doctor --host codex [--hooks-file <path>] [--launcher <path>]"
  ].join("\n");
}
function takeValue2(argv, index, flag) {
  const next = argv[index + 1];
  if (next === void 0 || next.length === 0)
    throw new Error(`${flag} requires a value`);
  return next;
}
function parseArgs2(argv) {
  let action = "save";
  let hooksAction;
  let host;
  let goal;
  let next;
  let stateMarkdown;
  let debtMarkdown;
  let runFolder;
  let controlPlane;
  let projectRoot;
  let hooksFile;
  let launcher;
  let recordId;
  let createdAt;
  let progress = false;
  let json = false;
  let start = 0;
  const first = argv[0];
  if (first === "save" || first === "resume" || first === "done" || first === "brief" || first === "hook") {
    action = first;
    start = 1;
  } else if (first === "hooks") {
    action = "hooks";
    const subcommand = argv[1];
    if (subcommand !== "install" && subcommand !== "uninstall" && subcommand !== "doctor") {
      throw new Error("handoff hooks requires install, uninstall, or doctor");
    }
    hooksAction = subcommand;
    start = 2;
  }
  for (let i = start; i < argv.length; i++) {
    const tok = argv[i];
    if (tok === void 0)
      continue;
    if (tok === "--host") {
      host = takeValue2(argv, i, tok);
      i += 1;
      continue;
    }
    if (tok === "--goal") {
      goal = takeValue2(argv, i, tok);
      i += 1;
      continue;
    }
    if (tok === "--next") {
      next = takeValue2(argv, i, tok);
      i += 1;
      continue;
    }
    if (tok === "--state-markdown") {
      stateMarkdown = takeValue2(argv, i, tok);
      i += 1;
      continue;
    }
    if (tok === "--debt-markdown") {
      debtMarkdown = takeValue2(argv, i, tok);
      i += 1;
      continue;
    }
    if (tok === "--run-folder") {
      runFolder = takeValue2(argv, i, tok);
      i += 1;
      continue;
    }
    if (tok === "--control-plane") {
      controlPlane = takeValue2(argv, i, tok);
      i += 1;
      continue;
    }
    if (tok === "--project-root") {
      projectRoot = takeValue2(argv, i, tok);
      i += 1;
      continue;
    }
    if (tok === "--hooks-file") {
      hooksFile = takeValue2(argv, i, tok);
      i += 1;
      continue;
    }
    if (tok === "--launcher") {
      launcher = takeValue2(argv, i, tok);
      i += 1;
      continue;
    }
    if (tok === "--record-id") {
      recordId = takeValue2(argv, i, tok);
      i += 1;
      continue;
    }
    if (tok === "--created-at") {
      createdAt = takeValue2(argv, i, tok);
      i += 1;
      continue;
    }
    if (tok === "--progress") {
      const value = takeValue2(argv, i, tok);
      if (value !== "jsonl")
        throw new Error("--progress only supports 'jsonl'");
      progress = true;
      i += 1;
      continue;
    }
    if (tok === "--json") {
      json = true;
      continue;
    }
    if (tok === "--help" || tok === "-h") {
      process.stdout.write(`${usage2()}
`);
      process.exit(0);
    }
    throw new Error(tok.startsWith("--") ? `unknown flag: ${tok}` : `unexpected argument: ${tok}`);
  }
  return {
    action,
    ...hooksAction === void 0 ? {} : { hooksAction },
    ...host === void 0 ? {} : { host },
    progress,
    json,
    ...goal === void 0 ? {} : { goal },
    ...next === void 0 ? {} : { next },
    ...stateMarkdown === void 0 ? {} : { stateMarkdown },
    ...debtMarkdown === void 0 ? {} : { debtMarkdown },
    ...runFolder === void 0 ? {} : { runFolder },
    ...controlPlane === void 0 ? {} : { controlPlane },
    ...projectRoot === void 0 ? {} : { projectRoot },
    ...hooksFile === void 0 ? {} : { hooksFile },
    ...launcher === void 0 ? {} : { launcher },
    ...recordId === void 0 ? {} : { recordId },
    ...createdAt === void 0 ? {} : { createdAt }
  };
}
function resolveProjectRootArg(args) {
  return resolve11(args.projectRoot ?? process.cwd());
}
function resolveControlPlaneArg(args) {
  if (args.controlPlane !== void 0)
    return resolve11(args.controlPlane);
  return resolve11(resolveProjectRootArg(args), DEFAULT_CONTROL_PLANE);
}
function continuityRoot(controlPlane) {
  return resolve11(controlPlane, "continuity");
}
function recordsRoot(controlPlane) {
  return join16(continuityRoot(controlPlane), "records");
}
function indexPath(controlPlane) {
  return join16(continuityRoot(controlPlane), "index.json");
}
function recordPath(controlPlane, recordId) {
  return join16(recordsRoot(controlPlane), `${recordId}.json`);
}
function utilityReportsRoot(controlPlane) {
  return join16(continuityRoot(controlPlane), "reports");
}
function handoffResultPath(controlPlane, action) {
  return join16(utilityReportsRoot(controlPlane), `${action}-result.json`);
}
function operatorSummaryPath(controlPlane) {
  return join16(utilityReportsRoot(controlPlane), "operator-summary.md");
}
function activeRunPath(controlPlane) {
  return join16(controlPlane, "active-run.md");
}
function writeJson2(path, value) {
  mkdirSync3(dirname9(path), { recursive: true });
  writeFileSync4(path, `${JSON.stringify(value, null, 2)}
`);
}
function writeMarkdown(path, value) {
  mkdirSync3(dirname9(path), { recursive: true });
  writeFileSync4(path, value.endsWith("\n") ? value : `${value}
`);
}
function composeHandoffBrief(record, state, debt) {
  return [
    "Circuit handoff is present for this repo.",
    "",
    `Goal: ${record.narrative.goal}`,
    `Next: ${record.narrative.next}`,
    "",
    "State:",
    state,
    "",
    "Open constraints or debt:",
    debt,
    "",
    "Boundary: Use this as context only. Do not continue unless the user asks.",
    "Useful commands: /circuit:handoff resume, /circuit:handoff done"
  ].join("\n");
}
function fitText(value, budget) {
  const marker = "\n[truncated]";
  if (value.length <= budget)
    return value;
  if (budget <= 0)
    return "";
  if (budget <= marker.length)
    return marker.slice(0, budget);
  return `${value.slice(0, budget - marker.length)}${marker}`;
}
function renderHandoffBrief(record) {
  const state = record.narrative.state_markdown;
  const debt = record.narrative.debt_markdown;
  const full = composeHandoffBrief(record, state, debt);
  if (full.length <= HANDOFF_BRIEF_MAX_CHARS) {
    return { ok: true, additionalContext: full };
  }
  const fixed = composeHandoffBrief(record, "", "");
  if (fixed.length > HANDOFF_BRIEF_MAX_CHARS) {
    return {
      ok: false,
      code: "brief_too_large",
      message: "Handoff goal and next action are too large to inject without dropping required safety framing."
    };
  }
  const remaining = Math.max(0, HANDOFF_BRIEF_MAX_CHARS - fixed.length);
  let stateBudget = Math.floor(remaining / 2);
  let debtBudget = remaining - stateBudget;
  if (state.length < stateBudget) {
    debtBudget += stateBudget - state.length;
    stateBudget = state.length;
  }
  if (debt.length < debtBudget) {
    stateBudget += debtBudget - debt.length;
    debtBudget = debt.length;
  }
  let renderedState = fitText(state, stateBudget);
  let renderedDebt = fitText(debt, debtBudget);
  let rendered = composeHandoffBrief(record, renderedState, renderedDebt);
  if (rendered.length > HANDOFF_BRIEF_MAX_CHARS) {
    const overflow = rendered.length - HANDOFF_BRIEF_MAX_CHARS;
    renderedDebt = fitText(renderedDebt, Math.max(0, renderedDebt.length - overflow));
    rendered = composeHandoffBrief(record, renderedState, renderedDebt);
  }
  if (rendered.length > HANDOFF_BRIEF_MAX_CHARS) {
    const overflow = rendered.length - HANDOFF_BRIEF_MAX_CHARS;
    renderedState = fitText(renderedState, Math.max(0, renderedState.length - overflow));
    rendered = composeHandoffBrief(record, renderedState, renderedDebt);
  }
  if (rendered.length > HANDOFF_BRIEF_MAX_CHARS) {
    return {
      ok: false,
      code: "brief_too_large",
      message: "Handoff brief could not fit within the injection cap."
    };
  }
  return { ok: true, additionalContext: rendered };
}
function emptyBrief(args, reason) {
  const projectRoot = resolveProjectRootArg(args);
  const controlPlane = resolveControlPlaneArg(args);
  return {
    api_version: HANDOFF_BRIEF_API_VERSION,
    schema_version: HANDOFF_BRIEF_SCHEMA_VERSION,
    status: "empty",
    reason,
    project_root: projectRoot,
    control_plane: controlPlane,
    index_path: indexPath(controlPlane)
  };
}
function invalidBrief(args, code, message, recordId) {
  const projectRoot = resolveProjectRootArg(args);
  const controlPlane = resolveControlPlaneArg(args);
  return {
    api_version: HANDOFF_BRIEF_API_VERSION,
    schema_version: HANDOFF_BRIEF_SCHEMA_VERSION,
    status: "invalid",
    project_root: projectRoot,
    control_plane: controlPlane,
    index_path: indexPath(controlPlane),
    ...recordId === void 0 ? {} : { record_id: recordId },
    error: { code, message }
  };
}
function handoffBrief(args) {
  const projectRoot = resolveProjectRootArg(args);
  const controlPlane = resolveControlPlaneArg(args);
  const indexAbs = indexPath(controlPlane);
  if (!existsSync12(indexAbs))
    return emptyBrief(args, "no_index");
  let index;
  try {
    index = ContinuityIndex.parse(JSON.parse(readFileSync24(indexAbs, "utf8")));
  } catch {
    return invalidBrief(args, "index_invalid", "Continuity index is malformed.");
  }
  if (index.pending_record === null)
    return emptyBrief(args, "no_pending_record");
  const recordAbs = recordPath(controlPlane, index.pending_record.record_id);
  if (!existsSync12(recordAbs)) {
    return invalidBrief(args, "record_missing", "Continuity index points at a missing record.", index.pending_record.record_id);
  }
  let record;
  try {
    record = ContinuityRecord.parse(JSON.parse(readFileSync24(recordAbs, "utf8")));
  } catch {
    return invalidBrief(args, "record_invalid", "Continuity record is malformed.", index.pending_record.record_id);
  }
  if (record.continuity_kind !== index.pending_record.continuity_kind) {
    return invalidBrief(args, "record_kind_mismatch", "Continuity index kind disagrees with the pointed record.", index.pending_record.record_id);
  }
  const rendered = renderHandoffBrief(record);
  if (!rendered.ok) {
    return invalidBrief(args, rendered.code, rendered.message, index.pending_record.record_id);
  }
  return {
    api_version: HANDOFF_BRIEF_API_VERSION,
    schema_version: HANDOFF_BRIEF_SCHEMA_VERSION,
    status: "available",
    project_root: projectRoot,
    control_plane: controlPlane,
    index_path: indexAbs,
    record_id: record.record_id,
    continuity_kind: record.continuity_kind,
    created_at: record.created_at,
    additional_context: rendered.additionalContext
  };
}
function debugHook(message) {
  if (process.env.CIRCUIT_HANDOFF_HOOK_DEBUG === "1") {
    process.stderr.write(`Circuit handoff hook: ${message}
`);
  }
}
function readHookInput() {
  if (process.stdin.isTTY)
    return {};
  const raw = readFileSync24(0, "utf8");
  if (raw.trim().length === 0)
    return {};
  return JSON.parse(raw);
}
function projectRootFromHookInput(input) {
  if (typeof input === "object" && input !== null && "cwd" in input && typeof input.cwd === "string" && input.cwd.length > 0) {
    return input.cwd;
  }
  return void 0;
}
function parseHookHost(args) {
  if (args.host === "codex")
    return "codex";
  throw new Error("handoff hook requires --host codex");
}
function runHandoffHook(args) {
  try {
    parseHookHost(args);
  } catch (err) {
    debugHook(err instanceof Error ? err.message : String(err));
    return 0;
  }
  let projectRoot = args.projectRoot;
  if (projectRoot === void 0) {
    let input;
    try {
      input = readHookInput();
    } catch (err) {
      debugHook(`could not parse hook input: ${err instanceof Error ? err.message : String(err)}`);
      return 0;
    }
    projectRoot = projectRootFromHookInput(input);
  }
  if (projectRoot === void 0 || projectRoot.length === 0) {
    debugHook("hook input did not include cwd; skipping handoff injection");
    return 0;
  }
  try {
    const brief = handoffBrief({
      action: "brief",
      projectRoot,
      progress: false,
      json: true
    });
    if (brief.status === "invalid") {
      debugHook(`brief state is invalid: ${brief.error?.code ?? "unknown"}`);
      return 0;
    }
    if (brief.status !== "available" || typeof brief.additional_context !== "string")
      return 0;
    process.stdout.write(`${JSON.stringify({
      hookSpecificOutput: {
        hookEventName: "SessionStart",
        additionalContext: brief.additional_context
      }
    })}
`);
  } catch (err) {
    debugHook(`brief command failed: ${err instanceof Error ? err.message : String(err)}`);
  }
  return 0;
}
function defaultCodexHooksFile() {
  const codexHome = process.env.CODEX_HOME ?? resolve11(homedir4(), ".codex");
  return resolve11(codexHome, "hooks.json");
}
function defaultLauncherPath() {
  return resolve11(dirname9(fileURLToPath(import.meta.url)), "../..", "bin/circuit-next");
}
function parseCodexHooksHost(args) {
  if (args.host === "codex")
    return "codex";
  throw new Error("handoff hooks requires --host codex");
}
function resolveHooksFileArg(args) {
  return resolve11(args.hooksFile ?? defaultCodexHooksFile());
}
function resolveLauncherArg(args) {
  const launcher = resolve11(args.launcher ?? defaultLauncherPath());
  if (!existsSync12(launcher)) {
    throw new Error(`Circuit launcher not found: ${launcher}`);
  }
  return launcher;
}
function shellQuote(value) {
  return `'${value.replace(/'/g, "'\\''")}'`;
}
function codexHookCommand(launcher) {
  return [
    CIRCUIT_HOOK_MARKER,
    shellQuote(process.execPath),
    shellQuote(launcher),
    "handoff",
    "hook",
    "--host",
    "codex"
  ].join(" ");
}
function defaultHooksConfig() {
  return { hooks: {} };
}
function readHooksConfig(path) {
  if (!existsSync12(path))
    return defaultHooksConfig();
  const parsed = JSON.parse(readFileSync24(path, "utf8"));
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new Error("hooks file must contain a JSON object");
  }
  return parsed;
}
function hooksObject(config) {
  const hooks = config.hooks;
  if (hooks === void 0) {
    const next = {};
    config.hooks = next;
    return next;
  }
  if (typeof hooks !== "object" || hooks === null || Array.isArray(hooks)) {
    throw new Error("hooks file has invalid hooks object");
  }
  return hooks;
}
function sessionStartEntries(config) {
  const entries = hooksObject(config).SessionStart;
  if (entries === void 0)
    return [];
  if (!Array.isArray(entries)) {
    throw new Error("hooks.SessionStart must be an array");
  }
  return entries;
}
function setSessionStartEntries(config, entries) {
  hooksObject(config).SessionStart = entries;
}
function circuitCodexHookEntry(command) {
  return {
    matcher: "startup|resume|clear",
    hooks: [
      {
        type: "command",
        command,
        timeout: 3
      }
    ]
  };
}
function isCircuitCodexHookEntry(entry) {
  return JSON.stringify(entry).includes("handoff hook --host codex");
}
function splitShellWords(command) {
  const words = [];
  let current = "";
  let inSingle = false;
  for (let i = 0; i < command.length; i++) {
    const char = command[i];
    if (char === "'") {
      inSingle = !inSingle;
      continue;
    }
    if (!inSingle && char === "\\" && i + 1 < command.length) {
      current += command[i + 1];
      i += 1;
      continue;
    }
    if (!inSingle && /\s/.test(char ?? "")) {
      if (current.length > 0) {
        words.push(current);
        current = "";
      }
      continue;
    }
    current += char;
  }
  if (current.length > 0)
    words.push(current);
  return words;
}
function commandFromHookHandler(value) {
  if (typeof value === "object" && value !== null && "command" in value && typeof value.command === "string") {
    return value.command;
  }
  return void 0;
}
function circuitHookCommands(entries) {
  const commands = [];
  for (const entry of entries) {
    if (typeof entry !== "object" || entry === null || !("hooks" in entry) || !Array.isArray(entry.hooks)) {
      continue;
    }
    for (const hook of entry.hooks) {
      const command = commandFromHookHandler(hook);
      if (command?.includes("handoff hook --host codex")) {
        commands.push(command);
      }
    }
  }
  return commands;
}
function circuitHookEntryCount(entries) {
  return entries.filter(isCircuitCodexHookEntry).length;
}
function launcherPathFromCircuitHookCommand(command) {
  const words = splitShellWords(command);
  const handoffIndex = words.findIndex((word, index) => word === "handoff" && words[index + 1] === "hook" && words[index + 2] === "--host" && words[index + 3] === "codex");
  if (handoffIndex < 1)
    return void 0;
  const launcher = words[handoffIndex - 1];
  if (launcher === void 0 || launcher.length === 0)
    return void 0;
  return launcher;
}
function writeHooksConfig(path, config) {
  mkdirSync3(dirname9(path), { recursive: true });
  let backupPath;
  if (existsSync12(path)) {
    const candidate = `${path}.circuit-backup`;
    if (!existsSync12(candidate)) {
      copyFileSync(path, candidate);
      backupPath = candidate;
    }
  }
  writeFileSync4(path, `${JSON.stringify(config, null, 2)}
`);
  return backupPath === void 0 ? {} : { backupPath };
}
function installCodexHandoffHook(args) {
  parseCodexHooksHost(args);
  const hooksPath = resolveHooksFileArg(args);
  const launcher = resolveLauncherArg(args);
  const command = codexHookCommand(launcher);
  const config = readHooksConfig(hooksPath);
  const entry = circuitCodexHookEntry(command);
  const entries = sessionStartEntries(config);
  const existingCircuitEntries = entries.filter(isCircuitCodexHookEntry);
  const alreadyInstalled = existingCircuitEntries.length === 1 && JSON.stringify(existingCircuitEntries[0]) === JSON.stringify(entry);
  if (alreadyInstalled) {
    return {
      api_version: HANDOFF_HOOKS_API_VERSION,
      schema_version: HANDOFF_HOOKS_SCHEMA_VERSION,
      host: "codex",
      action: "install",
      status: "already_installed",
      hooks_path: hooksPath,
      launcher,
      command
    };
  }
  setSessionStartEntries(config, [
    ...entries.filter((item) => !isCircuitCodexHookEntry(item)),
    entry
  ]);
  const { backupPath } = writeHooksConfig(hooksPath, config);
  return {
    api_version: HANDOFF_HOOKS_API_VERSION,
    schema_version: HANDOFF_HOOKS_SCHEMA_VERSION,
    host: "codex",
    action: "install",
    status: "installed",
    hooks_path: hooksPath,
    launcher,
    command,
    ...backupPath === void 0 ? {} : { backup_path: backupPath }
  };
}
function uninstallCodexHandoffHook(args) {
  parseCodexHooksHost(args);
  const hooksPath = resolveHooksFileArg(args);
  if (!existsSync12(hooksPath)) {
    return {
      api_version: HANDOFF_HOOKS_API_VERSION,
      schema_version: HANDOFF_HOOKS_SCHEMA_VERSION,
      host: "codex",
      action: "uninstall",
      status: "not_installed",
      hooks_path: hooksPath
    };
  }
  const config = readHooksConfig(hooksPath);
  const entries = sessionStartEntries(config);
  const nextEntries = entries.filter((item) => !isCircuitCodexHookEntry(item));
  if (nextEntries.length === entries.length) {
    return {
      api_version: HANDOFF_HOOKS_API_VERSION,
      schema_version: HANDOFF_HOOKS_SCHEMA_VERSION,
      host: "codex",
      action: "uninstall",
      status: "not_installed",
      hooks_path: hooksPath
    };
  }
  setSessionStartEntries(config, nextEntries);
  const { backupPath } = writeHooksConfig(hooksPath, config);
  return {
    api_version: HANDOFF_HOOKS_API_VERSION,
    schema_version: HANDOFF_HOOKS_SCHEMA_VERSION,
    host: "codex",
    action: "uninstall",
    status: "uninstalled",
    hooks_path: hooksPath,
    ...backupPath === void 0 ? {} : { backup_path: backupPath }
  };
}
function doctorCodexHandoffHook(args) {
  parseCodexHooksHost(args);
  const hooksPath = resolveHooksFileArg(args);
  const checks = [];
  checks.push({ name: "hooks_file_exists", ok: existsSync12(hooksPath), detail: hooksPath });
  let config;
  try {
    config = readHooksConfig(hooksPath);
    checks.push({ name: "hooks_file_parseable", ok: true, detail: hooksPath });
  } catch (err) {
    checks.push({
      name: "hooks_file_parseable",
      ok: false,
      detail: err instanceof Error ? err.message : String(err)
    });
  }
  if (config !== void 0) {
    try {
      const entries = sessionStartEntries(config);
      const circuitEntryCount = circuitHookEntryCount(entries);
      const commands = circuitHookCommands(entries);
      const launchers = commands.map(launcherPathFromCircuitHookCommand).filter((item) => item !== void 0);
      checks.push({ name: "session_start_array", ok: true, detail: `${entries.length} entries` });
      checks.push({
        name: "circuit_handoff_hook_installed",
        ok: circuitEntryCount > 0,
        detail: `${circuitEntryCount} Circuit hooks in ${hooksPath}`
      });
      checks.push({
        name: "circuit_handoff_hook_single",
        ok: circuitEntryCount === 1 && commands.length === 1,
        detail: `${circuitEntryCount} Circuit entries, ${commands.length} Circuit commands`
      });
      checks.push({
        name: "circuit_handoff_hook_launcher_exists",
        ok: launchers.length > 0 && launchers.every((launcher) => existsSync12(launcher)),
        detail: launchers.length > 0 ? launchers.join(", ") : "launcher not found in hook command"
      });
    } catch (err) {
      checks.push({
        name: "session_start_array",
        ok: false,
        detail: err instanceof Error ? err.message : String(err)
      });
      checks.push({
        name: "circuit_handoff_hook_installed",
        ok: false,
        detail: hooksPath
      });
      checks.push({
        name: "circuit_handoff_hook_launcher_exists",
        ok: false,
        detail: "launcher not found in hook command"
      });
    }
  }
  const failed = checks.filter((item) => !item.ok && item.severity !== "warning");
  const installedCheck = checks.find((item) => item.name === "circuit_handoff_hook_installed");
  const structuralFailure = failed.some((item) => item.name === "hooks_file_parseable" || item.name === "session_start_array");
  const status = !existsSync12(hooksPath) ? "missing" : structuralFailure ? "invalid" : installedCheck?.ok === false ? "missing" : failed.length === 0 ? "ok" : "invalid";
  return {
    api_version: HANDOFF_HOOKS_API_VERSION,
    schema_version: HANDOFF_HOOKS_SCHEMA_VERSION,
    host: "codex",
    action: "doctor",
    status,
    hooks_path: hooksPath,
    checks
  };
}
function runHandoffHooksCommand(args) {
  if (args.hooksAction === "install")
    return installCodexHandoffHook(args);
  if (args.hooksAction === "uninstall")
    return uninstallCodexHandoffHook(args);
  if (args.hooksAction === "doctor")
    return doctorCodexHandoffHook(args);
  throw new Error("handoff hooks requires install, uninstall, or doctor");
}
function stageForCurrentStep(flow, currentStep) {
  const stage = flow.stages.find((candidate) => candidate.steps.includes(currentStep));
  return stage?.canonical ?? stage?.id ?? "frame";
}
function snapshotStatusFromRunStatus(status) {
  switch (status.engine_state) {
    case "open":
    case "waiting_checkpoint":
      return "in_progress";
    case "completed":
      return status.terminal_outcome;
    case "aborted":
      return "aborted";
    case "invalid":
      throw new Error("cannot save run-backed continuity: run status is invalid");
  }
}
function loadRunBackedSnapshot(runFolder) {
  const status = projectRunStatusFromRunFolder(runFolder);
  if (status.engine_state === "invalid") {
    throw new Error(`cannot save run-backed continuity: ${status.error.message}`);
  }
  const manifest = readManifestSnapshot(runFolder);
  const flow = CompiledFlow.parse(JSON.parse(Buffer.from(manifest.bytes_base64, "base64").toString("utf8")));
  const currentStep = ("current_step" in status ? status.current_step?.step_id : void 0) ?? flow.entry_modes[0]?.start_at;
  if (currentStep === void 0) {
    throw new Error(`cannot save run-backed continuity: ${runFolder} has no current step`);
  }
  const updatedAt = status.last_event?.timestamp;
  if (updatedAt === void 0) {
    throw new Error(`cannot save run-backed continuity: ${runFolder} has no latest event`);
  }
  return {
    snapshot: {
      run_id: status.run_id,
      current_step: currentStep,
      status: snapshotStatusFromRunStatus(status),
      updated_at: updatedAt
    },
    currentStage: stageForCurrentStep(flow, currentStep)
  };
}
function buildRecord(args, now) {
  if (args.goal === void 0 || args.goal.length === 0) {
    throw new Error("--goal is required when saving handoff continuity");
  }
  if (args.next === void 0 || args.next.length === 0) {
    throw new Error("--next is required when saving handoff continuity");
  }
  const projectRoot = resolveProjectRootArg(args);
  const createdAt = args.createdAt ?? now().toISOString();
  const recordId = args.recordId ?? `continuity-${randomUUID6()}`;
  const base = {
    schema_version: 1,
    record_id: recordId,
    project_root: projectRoot,
    created_at: createdAt,
    git: { cwd: projectRoot },
    narrative: {
      goal: args.goal,
      next: args.next,
      state_markdown: args.stateMarkdown ?? "- No extra session state was provided.",
      debt_markdown: args.debtMarkdown ?? "- No open debt was recorded."
    }
  };
  if (args.runFolder === void 0) {
    return ContinuityRecord.parse({
      ...base,
      continuity_kind: "standalone",
      resume_contract: {
        mode: "resume_standalone",
        auto_resume: false,
        requires_explicit_resume: true
      }
    });
  }
  const runFolder = resolve11(args.runFolder);
  const { snapshot, currentStage } = loadRunBackedSnapshot(runFolder);
  if (snapshot.current_step === void 0) {
    throw new Error(`cannot save run-backed continuity: ${runFolder} has no current step`);
  }
  return ContinuityRecord.parse({
    ...base,
    continuity_kind: "run-backed",
    run_ref: {
      run_id: snapshot.run_id,
      ...snapshot.invocation_id === void 0 ? {} : { invocation_id: snapshot.invocation_id },
      current_stage: currentStage,
      current_step: snapshot.current_step,
      runtime_status: snapshot.status,
      runtime_updated_at: snapshot.updated_at
    },
    resume_contract: {
      mode: "resume_run",
      auto_resume: false,
      requires_explicit_resume: true
    }
  });
}
function summaryForRecord(record, source) {
  return [
    "# Circuit Handoff",
    "",
    `Source: ${source}`,
    `Record: ${record.record_id}`,
    `Kind: ${record.continuity_kind}`,
    "",
    "## Goal",
    record.narrative.goal,
    "",
    "## Next Action",
    record.narrative.next,
    "",
    "## State",
    record.narrative.state_markdown,
    "",
    "## Debt",
    record.narrative.debt_markdown
  ].join("\n");
}
function writeActiveRun(controlPlane, record) {
  if (record.continuity_kind !== "run-backed")
    return void 0;
  const path = activeRunPath(controlPlane);
  writeMarkdown(path, [
    "# Active Circuit Run",
    "",
    `Run: ${record.run_ref.run_id}`,
    `Status: ${record.run_ref.runtime_status}`,
    `Stage: ${record.run_ref.current_stage}`,
    `Step: ${record.run_ref.current_step}`,
    "",
    `Next: ${record.narrative.next}`
  ].join("\n"));
  return path;
}
function saveContinuity(args, now) {
  const controlPlane = resolveControlPlaneArg(args);
  const record = buildRecord(args, now);
  const recordAbs = recordPath(controlPlane, record.record_id);
  writeJson2(recordAbs, record);
  const index = ContinuityIndex.parse({
    schema_version: 1,
    project_root: record.project_root,
    pending_record: {
      record_id: record.record_id,
      continuity_kind: record.continuity_kind,
      created_at: record.created_at
    },
    current_run: record.continuity_kind === "run-backed" ? {
      run_id: record.run_ref.run_id,
      current_stage: record.run_ref.current_stage,
      current_step: record.run_ref.current_step,
      runtime_status: record.run_ref.runtime_status,
      attached_at: record.created_at,
      last_validated_at: record.created_at
    } : null
  });
  writeJson2(indexPath(controlPlane), index);
  const activeRun = writeActiveRun(controlPlane, record);
  const summaryPath2 = operatorSummaryPath(controlPlane);
  writeMarkdown(summaryPath2, summaryForRecord(record, "saved continuity record"));
  const result = {
    schema_version: 1,
    action: "save",
    status: "saved",
    record_id: record.record_id,
    continuity_path: recordAbs,
    index_path: indexPath(controlPlane),
    ...activeRun === void 0 ? {} : { active_run_path: activeRun },
    operator_summary_markdown_path: summaryPath2
  };
  const resultPath2 = handoffResultPath(controlPlane, "save");
  writeJson2(resultPath2, result);
  return { ...result, result_path: resultPath2 };
}
function resumeContinuity(args) {
  const controlPlane = resolveControlPlaneArg(args);
  const indexAbs = indexPath(controlPlane);
  if (!existsSync12(indexAbs)) {
    const summaryPath3 = operatorSummaryPath(controlPlane);
    writeMarkdown(summaryPath3, "# Circuit Handoff\n\nNo saved continuity found.");
    const result2 = {
      schema_version: 1,
      action: "resume",
      status: "not_found",
      index_path: indexAbs,
      operator_summary_markdown_path: summaryPath3
    };
    const resultPath3 = handoffResultPath(controlPlane, "resume");
    writeJson2(resultPath3, result2);
    return { ...result2, result_path: resultPath3 };
  }
  const index = ContinuityIndex.parse(JSON.parse(readFileSync24(indexAbs, "utf8")));
  if (index.pending_record === null) {
    const summaryPath3 = operatorSummaryPath(controlPlane);
    writeMarkdown(summaryPath3, "# Circuit Handoff\n\nNo saved continuity found.");
    const result2 = {
      schema_version: 1,
      action: "resume",
      status: "not_found",
      index_path: indexAbs,
      operator_summary_markdown_path: summaryPath3
    };
    const resultPath3 = handoffResultPath(controlPlane, "resume");
    writeJson2(resultPath3, result2);
    return { ...result2, result_path: resultPath3 };
  }
  const recordAbs = recordPath(controlPlane, index.pending_record.record_id);
  if (!existsSync12(recordAbs)) {
    throw new Error(`continuity index points at missing record: ${recordAbs}`);
  }
  const record = ContinuityRecord.parse(JSON.parse(readFileSync24(recordAbs, "utf8")));
  if (record.continuity_kind !== index.pending_record.continuity_kind) {
    throw new Error(`continuity index kind '${index.pending_record.continuity_kind}' disagrees with record kind '${record.continuity_kind}' for ${record.record_id}`);
  }
  const summaryPath2 = operatorSummaryPath(controlPlane);
  writeMarkdown(summaryPath2, summaryForRecord(record, "pending_record"));
  const result = {
    schema_version: 1,
    action: "resume",
    status: "resumed",
    source: "pending_record",
    record_id: record.record_id,
    continuity_path: recordAbs,
    index_path: indexAbs,
    operator_summary_markdown_path: summaryPath2
  };
  const resultPath2 = handoffResultPath(controlPlane, "resume");
  writeJson2(resultPath2, result);
  return { ...result, result_path: resultPath2 };
}
function clearContinuity(args, now) {
  const controlPlane = resolveControlPlaneArg(args);
  const projectRoot = resolveProjectRootArg(args);
  const createdAt = args.createdAt ?? now().toISOString();
  const index = ContinuityIndex.parse({
    schema_version: 1,
    project_root: projectRoot,
    pending_record: null,
    current_run: null
  });
  writeJson2(indexPath(controlPlane), index);
  const summaryPath2 = operatorSummaryPath(controlPlane);
  writeMarkdown(summaryPath2, "# Circuit Handoff\n\nContinuity cleared.");
  const result = {
    schema_version: 1,
    action: "done",
    status: "cleared",
    index_path: indexPath(controlPlane),
    operator_summary_markdown_path: summaryPath2,
    cleared_at: createdAt
  };
  const resultPath2 = handoffResultPath(controlPlane, "done");
  writeJson2(resultPath2, result);
  return { ...result, result_path: resultPath2 };
}
async function runHandoffCommand(argv, options = {}) {
  let args;
  try {
    args = parseArgs2(argv);
  } catch (err) {
    process.stderr.write(`error: ${err.message}
`);
    return 2;
  }
  if (args.action === "brief") {
    if (!args.json) {
      process.stderr.write("error: handoff brief requires --json\n");
      return 2;
    }
    process.stdout.write(`${JSON.stringify(handoffBrief(args), null, 2)}
`);
    return 0;
  }
  if (args.action === "hook") {
    return runHandoffHook(args);
  }
  if (args.action === "hooks") {
    try {
      process.stdout.write(`${JSON.stringify(runHandoffHooksCommand(args), null, 2)}
`);
      return 0;
    } catch (err) {
      process.stderr.write(`error: ${err.message}
`);
      return 1;
    }
  }
  const now = options.now ?? (() => /* @__PURE__ */ new Date());
  const progress = utilityProgress({
    enabled: args.progress,
    flowId: "handoff",
    now
  });
  if (progress !== void 0) {
    progress.emit({
      type: "route.selected",
      recorded_at: now().toISOString(),
      label: "Selected Handoff",
      display: {
        text: `Circuit selected handoff ${args.action}.`,
        importance: "major",
        tone: "info"
      },
      presentation: progressPresentation({
        blockId: progress.runId,
        statusText: `Chose handoff ${args.action}.`
      }),
      selected_flow: "handoff",
      routed_by: "explicit",
      router_reason: "explicit handoff utility command"
    });
  }
  try {
    const result = args.action === "save" ? saveContinuity(args, now) : args.action === "resume" ? resumeContinuity(args) : clearContinuity(args, now);
    if (progress !== void 0) {
      const statusText = args.action === "resume" && result.status === "not_found" ? "No saved Circuit handoff was found." : `Handoff ${args.action} completed.`;
      progress.emit({
        type: "run.completed",
        recorded_at: now().toISOString(),
        label: "Handoff completed",
        display: {
          text: args.action === "resume" && result.status === "not_found" ? "No saved Circuit handoff was found." : `Circuit handoff ${args.action} completed.`,
          importance: "major",
          tone: result.status === "not_found" ? "warning" : "success"
        },
        presentation: progressPresentation({
          blockId: progress.runId,
          statusText
        }),
        outcome: "complete",
        result_path: result.result_path
      });
    }
    process.stdout.write(`${JSON.stringify(result, null, 2)}
`);
    return 0;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    process.stderr.write(`error: ${message}
`);
    return 1;
  }
}

// dist/cli/runs.js
function engineError(input) {
  return EngineErrorV1.parse({
    api_version: "engine-error-v1",
    schema_version: 1,
    error: {
      code: input.code,
      message: input.message
    },
    ...input.runFolder === void 0 ? {} : { run_folder: input.runFolder }
  });
}
function writeJson3(value) {
  process.stdout.write(`${JSON.stringify(value, null, 2)}
`);
}
function invalidInvocation(message, runFolder) {
  writeJson3(engineError({
    code: "invalid_invocation",
    message,
    ...runFolder === void 0 ? {} : { runFolder }
  }));
  return 2;
}
function parseShowArgs(argv) {
  let runFolder;
  let json = false;
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (token === void 0)
      continue;
    if (token === "--json") {
      json = true;
      continue;
    }
    if (token === "--run-folder") {
      const value = argv[i + 1];
      if (value === void 0 || value.length === 0)
        return "--run-folder requires a value";
      if (runFolder !== void 0)
        return "supply --run-folder only once";
      runFolder = value;
      i += 1;
      continue;
    }
    if (token.startsWith("--"))
      return `unknown flag: ${token}`;
    return `unexpected positional argument: ${token}`;
  }
  if (!json)
    return "runs show requires --json";
  if (runFolder === void 0)
    return "--run-folder is required";
  return { runFolder };
}
async function runRunsCommand(argv) {
  const subcommand = argv[0];
  if (subcommand !== "show") {
    return invalidInvocation(subcommand === void 0 ? "runs requires a subcommand" : `unknown runs subcommand: ${subcommand}`);
  }
  const parsed = parseShowArgs(argv.slice(1));
  if (typeof parsed === "string")
    return invalidInvocation(parsed);
  try {
    writeJson3(projectRunStatusFromRunFolder(parsed.runFolder));
    return 0;
  } catch (err) {
    if (err instanceof RunStatusFolderError) {
      writeJson3(engineError({
        code: err.code,
        message: err.message,
        runFolder: err.runFolder
      }));
      return 1;
    }
    writeJson3(engineError({
      code: "internal_error",
      message: err instanceof Error ? err.message : String(err),
      runFolder: parsed.runFolder
    }));
    return 1;
  }
}

// dist/cli/circuit.js
var DEFAULT_RUNS_BASE = ".circuit-next/runs";
var DEFAULT_DEV_VERSION = "0.0.0-dev";
var RUNTIME_SUPPORT_MATRIX = {
  review: [{ entryModeName: "default", depth: "standard" }],
  fix: [
    { entryModeName: "default", depth: "standard" },
    { entryModeName: "lite", depth: "lite" },
    { entryModeName: "deep", depth: "deep" },
    { entryModeName: "autonomous", depth: "autonomous" }
  ],
  build: [
    { entryModeName: "default", depth: "standard" },
    { entryModeName: "lite", depth: "lite" },
    { entryModeName: "deep", depth: "deep" },
    { entryModeName: "autonomous", depth: "autonomous" }
  ],
  explore: [
    { entryModeName: "default", depth: "standard" },
    { entryModeName: "lite", depth: "lite" },
    { entryModeName: "deep", depth: "deep" },
    { entryModeName: "autonomous", depth: "autonomous" },
    { entryModeName: "tournament", depth: "tournament" }
  ],
  migrate: [
    { entryModeName: "default", depth: "standard" },
    { entryModeName: "deep", depth: "deep" },
    { entryModeName: "autonomous", depth: "autonomous" }
  ],
  sweep: [
    { entryModeName: "default", depth: "standard" },
    { entryModeName: "lite", depth: "lite" },
    { entryModeName: "deep", depth: "deep" },
    { entryModeName: "autonomous", depth: "autonomous" }
  ]
};
function usage3() {
  return [
    'usage: circuit-next run [flow-name] --goal "<goal>" [--mode <default|lite|deep|autonomous>] [--depth <lite|standard|deep|tournament|autonomous>] [--run-folder <path>] [--fixture <path>] [--flow-root <path>] [--progress jsonl]',
    "       circuit-next resume --run-folder <path> --checkpoint-choice <choice> [--progress jsonl]",
    "       circuit-next runs show --run-folder <path> --json",
    "       circuit-next handoff [save|resume|done] [options]",
    '       circuit-next create --description "<flow idea>" [--name <slug>] [--publish --yes]',
    "       circuit-next version [--json]",
    "",
    "`--mode` is the friendly alias for `--entry-mode`; supplying both forms of that option is an error.",
    "",
    "With an explicit flow name, loads generated/flows/<name>/circuit.json. Without one, classifies the free-form goal across the registered explore/review/fix/build/migrate/sweep flows and then composes the runtime boundary using the configured relay connector.",
    "",
    "Config: if present, loads ~/.config/circuit-next/config.yaml and ./.circuit/config.yaml from the current working directory into the selection resolver before relay.",
    "",
    "Note: `--dry-run` is not implemented and is rejected. An earlier version silently invoked the real connector while reporting dry_run:true, which is a safety bug; the flag stays rejected until real dry-run support lands.",
    "",
    CLI_RUNTIME_ROUTING_POLICY,
    "",
    "Review evidence: untracked file contents are omitted by default. Add `--include-untracked-content` only when those files are safe to relay to the configured worker."
  ].join("\n");
}
function readSourceVersion() {
  if (true)
    return "0.1.0-alpha.4";
  const candidates = [
    resolve12(dirname10(fileURLToPath2(import.meta.url)), "../../plugins/version.json"),
    resolve12(process.cwd(), "plugins/version.json")
  ];
  for (const candidate of candidates) {
    try {
      const raw = JSON.parse(readFileSync25(candidate, "utf8"));
      if (typeof raw.version === "string" && raw.version.length > 0)
        return raw.version;
    } catch {
    }
  }
  return DEFAULT_DEV_VERSION;
}
function versionInfo() {
  return {
    schema_version: 1,
    name: "circuit-next",
    version: readSourceVersion(),
    node_version: process.versions.node,
    runtime_source: process.env.CIRCUIT_RUNTIME_SOURCE ?? "direct",
    ...process.env.CIRCUIT_RUNTIME_PATH === void 0 ? {} : { runtime_path: process.env.CIRCUIT_RUNTIME_PATH },
    ...process.env.CIRCUIT_PLUGIN_ROOT === void 0 ? {} : { plugin_root: process.env.CIRCUIT_PLUGIN_ROOT }
  };
}
function runVersionCommand(argv) {
  if (argv.length === 0) {
    process.stdout.write(`${readSourceVersion()}
`);
    return 0;
  }
  if (argv.length === 1 && argv[0] === "--json") {
    process.stdout.write(`${JSON.stringify(versionInfo(), null, 2)}
`);
    return 0;
  }
  process.stderr.write("error: usage: circuit-next version [--json]\n");
  return 2;
}
function parseArgs3(argv) {
  let flowName;
  let command;
  let goal;
  let depth;
  let depthProvided = false;
  let entryMode;
  let runFolder;
  let fixturePath;
  let flowRoot2;
  let checkpointChoice;
  let progress;
  let includeUntrackedContent = false;
  for (let i = 0; i < argv.length; i++) {
    const tok = argv[i];
    if (tok === void 0)
      continue;
    if (tok === "--goal") {
      const next = argv[i + 1];
      if (next === void 0)
        throw new Error("--goal requires a value");
      goal = next;
      i += 1;
      continue;
    }
    if (tok === "--depth") {
      const next = argv[i + 1];
      if (next === void 0)
        throw new Error(`${tok} requires a value`);
      if (depthProvided) {
        throw new Error("supply --depth only once");
      }
      depth = Depth.parse(next);
      depthProvided = true;
      i += 1;
      continue;
    }
    if (tok === "--entry-mode" || tok === "--mode") {
      const next = argv[i + 1];
      if (next === void 0)
        throw new Error(`${tok} requires a value`);
      if (next.length === 0)
        throw new Error(`${tok} requires a non-empty value`);
      if (entryMode !== void 0) {
        throw new Error("use either --mode or --entry-mode, not both");
      }
      entryMode = next;
      i += 1;
      continue;
    }
    if (tok === "--run-folder") {
      const next = argv[i + 1];
      if (next === void 0)
        throw new Error(`${tok} requires a value`);
      if (runFolder !== void 0) {
        throw new Error("supply --run-folder only once");
      }
      runFolder = next;
      i += 1;
      continue;
    }
    if (tok === "--fixture") {
      const next = argv[i + 1];
      if (next === void 0)
        throw new Error("--fixture requires a value");
      fixturePath = next;
      i += 1;
      continue;
    }
    if (tok === "--flow-root") {
      const next = argv[i + 1];
      if (next === void 0)
        throw new Error("--flow-root requires a value");
      if (next.length === 0)
        throw new Error("--flow-root requires a non-empty value");
      if (flowRoot2 !== void 0) {
        throw new Error("supply --flow-root only once");
      }
      flowRoot2 = next;
      i += 1;
      continue;
    }
    if (tok === "--checkpoint-choice") {
      const next = argv[i + 1];
      if (next === void 0)
        throw new Error("--checkpoint-choice requires a value");
      checkpointChoice = next;
      i += 1;
      continue;
    }
    if (tok === "--progress") {
      const next = argv[i + 1];
      if (next === void 0)
        throw new Error("--progress requires a value");
      if (next !== "jsonl")
        throw new Error("--progress only supports 'jsonl'");
      progress = "jsonl";
      i += 1;
      continue;
    }
    if (tok === "--dry-run") {
      throw new Error("--dry-run is not currently implemented and is rejected. An earlier version silently invoked the real connector while reporting dry_run:true, which is a safety bug. The flag stays rejected until real dry-run support lands.");
    }
    if (tok === "--include-untracked-content") {
      includeUntrackedContent = true;
      continue;
    }
    if (tok === "--help" || tok === "-h") {
      process.stdout.write(`${usage3()}
`);
      process.exit(0);
    }
    if (tok.startsWith("--")) {
      throw new Error(`unknown flag: ${tok}`);
    }
    if ((tok === "run" || tok === "resume") && flowName === void 0 && command === void 0) {
      command = tok;
      continue;
    }
    if (flowName === void 0) {
      flowName = tok;
      continue;
    }
    throw new Error(`unexpected positional argument: ${tok}`);
  }
  if (command === "resume" || checkpointChoice !== void 0) {
    if (command !== "resume") {
      throw new Error("checkpoint resume must use the `resume` subcommand");
    }
    if (runFolder === void 0)
      throw new Error("--run-folder is required for checkpoint resume");
    if (checkpointChoice === void 0 || checkpointChoice.length === 0) {
      throw new Error("--checkpoint-choice is required for checkpoint resume");
    }
    if (flowName !== void 0) {
      throw new Error("checkpoint resume loads the saved flow manifest; omit flow-name");
    }
    if (goal !== void 0) {
      throw new Error("checkpoint resume reuses the saved run goal; omit --goal");
    }
    if (fixturePath !== void 0) {
      throw new Error("checkpoint resume loads the saved flow manifest; omit --fixture");
    }
    if (flowRoot2 !== void 0) {
      throw new Error("checkpoint resume loads the saved flow manifest; omit --flow-root");
    }
    if (depthProvided) {
      throw new Error("checkpoint resume reuses the saved run depth; omit --depth");
    }
    if (entryMode !== void 0) {
      throw new Error("checkpoint resume reuses the saved flow position; omit --mode/--entry-mode");
    }
    if (includeUntrackedContent) {
      throw new Error("checkpoint resume reuses the saved evidence policy; omit --include-untracked-content");
    }
  } else if (goal === void 0 || goal.length === 0) {
    throw new Error("--goal is required and must be non-empty");
  }
  const result = {
    depthProvided,
    includeUntrackedContent
  };
  if (depth !== void 0)
    result.depth = depth;
  if (entryMode !== void 0)
    result.entryMode = entryMode;
  if (command !== void 0)
    result.command = command;
  if (goal !== void 0)
    result.goal = goal;
  if (flowName !== void 0)
    result.flowName = flowName;
  if (runFolder !== void 0)
    result.runFolder = runFolder;
  if (fixturePath !== void 0)
    result.fixturePath = fixturePath;
  if (flowRoot2 !== void 0)
    result.flowRoot = flowRoot2;
  if (checkpointChoice !== void 0)
    result.checkpointChoice = checkpointChoice;
  if (progress !== void 0)
    result.progress = progress;
  return result;
}
function resolveFixturePath(flowName, modeName, override, flowRoot2) {
  if (override !== void 0)
    return resolve12(override);
  const root = resolve12(flowRoot2 ?? "generated/flows");
  if (modeName !== void 0) {
    const perMode = resolve12(root, flowName, `${modeName}.json`);
    if (existsSync13(perMode))
      return perMode;
  }
  return resolve12(root, flowName, "circuit.json");
}
function progressReporter(enabled) {
  if (!enabled)
    return void 0;
  return (event) => {
    const parsed = ProgressEvent.parse(event);
    process.stderr.write(`${JSON.stringify(parsed)}
`);
  };
}
function routeSelectedStatusText(flowId, entryModeName) {
  return entryModeName === void 0 ? `Chose ${flowId}.` : `Chose ${flowId} with ${entryModeName} thoroughness.`;
}
function resolveCompiledFlowRoute(args) {
  if (args.flowName !== void 0) {
    return {
      flowName: args.flowName,
      source: "explicit",
      reason: "explicit flow positional argument"
    };
  }
  if (args.goal === void 0) {
    throw new Error("--goal is required when not resuming a checkpoint");
  }
  return classifyCompiledFlowTask(args.goal);
}
function resolveEntryModeSelection(args, route) {
  if (args.entryMode !== void 0) {
    return {
      entryModeName: args.entryMode,
      source: "explicit",
      reason: "explicit --mode/--entry-mode argument"
    };
  }
  if (args.depthProvided)
    return {};
  if (route.inferredEntryModeName !== void 0) {
    return {
      entryModeName: route.inferredEntryModeName,
      source: "classifier",
      ...route.inferredEntryModeReason === void 0 ? {} : { reason: route.inferredEntryModeReason }
    };
  }
  return {};
}
function loadFixture(fixturePath) {
  if (!existsSync13(fixturePath)) {
    throw new Error(`flow fixture not found: ${fixturePath}`);
  }
  const bytes = readFileSync25(fixturePath);
  const raw = JSON.parse(bytes.toString("utf8"));
  const flow = CompiledFlow.parse(raw);
  const policy2 = validateCompiledFlowKindPolicy(flow);
  if (!policy2.ok) {
    throw new Error(`flow fixture policy violation (${fixturePath}):
  ${policy2.reason}`);
  }
  return { flow, bytes };
}
function defaultChildCompiledFlowResolver(flowRoot2) {
  return (ref) => {
    const fixturePath = resolveFixturePath(ref.flowId, ref.entryMode, void 0, flowRoot2);
    const { bytes } = loadFixture(fixturePath);
    return { flowBytes: bytes };
  };
}
function assertFixtureMatchesRoute(flow, route) {
  const flowId = flow.id;
  if (flowId !== route.flowName) {
    throw new Error(`flow fixture id mismatch: selected flow '${route.flowName}' but fixture declares '${flowId}'`);
  }
}
function selectedEntryMode(flow, entryModeSelection) {
  const entryName = entryModeSelection.entryModeName;
  const entry = entryName === void 0 ? flow.entry_modes[0] : flow.entry_modes.find((mode) => mode.name === entryName);
  if (entry === void 0) {
    throw new Error(entryName === void 0 ? `flow '${flow.id}' declares no entry modes` : `flow '${flow.id}' declares no entry_mode named '${entryName}'`);
  }
  return entry;
}
function selectedEntryModeName(flow, entryModeSelection) {
  return selectedEntryMode(flow, entryModeSelection).name;
}
function selectedDepth(flow, args, entryModeSelection) {
  if (args.depth !== void 0)
    return args.depth;
  return selectedEntryMode(flow, entryModeSelection).depth;
}
function customFlowArchetype(input) {
  if (input.args.flowRoot === void 0 || input.args.fixturePath !== void 0)
    return void 0;
  try {
    const flowRoot2 = resolve12(input.args.flowRoot);
    const manifest = JSON.parse(readFileSync25(resolve12(dirname10(flowRoot2), "manifest.json"), "utf8"));
    if (manifest === null || typeof manifest !== "object" || Array.isArray(manifest)) {
      return void 0;
    }
    const customFlows = manifest.custom_flows;
    if (!Array.isArray(customFlows))
      return void 0;
    const flowId = input.flow.id;
    const fixturePath = resolve12(input.fixturePath);
    for (const candidate of customFlows) {
      if (candidate === null || typeof candidate !== "object" || Array.isArray(candidate))
        continue;
      const entry = candidate;
      if (entry.id !== flowId)
        continue;
      if (typeof entry.flow_path !== "string" || resolve12(entry.flow_path) !== fixturePath)
        continue;
      return typeof entry.archetype === "string" && entry.archetype.length > 0 ? entry.archetype : void 0;
    }
    return void 0;
  } catch {
    return void 0;
  }
}
function classifyRuntimeSupport(input) {
  const flowId = input.flow.id;
  const entryModeName = selectedEntryModeName(input.flow, input.entryModeSelection);
  const depth = selectedDepth(input.flow, input.args, input.entryModeSelection);
  const supportMatrix = input.supportMatrix ?? RUNTIME_SUPPORT_MATRIX;
  const customArchetype = customFlowArchetype({
    flow: input.flow,
    args: input.args,
    fixturePath: input.fixturePath
  });
  const directRows = supportMatrix[flowId];
  const customArchetypeRows = customArchetype === void 0 ? void 0 : supportMatrix[customArchetype];
  const rows = directRows ?? customArchetypeRows;
  const customArchetypeSupported = directRows === void 0 && customArchetypeRows !== void 0;
  if (rows === void 0) {
    return {
      kind: "unsupported",
      flowId,
      entryModeName,
      depth,
      reason: `flow '${flowId}' is not in the runtime support matrix`
    };
  }
  const supported = rows.some((row) => row.entryModeName === entryModeName && row.depth === depth);
  if (supported) {
    return {
      kind: "supported",
      flowId,
      entryModeName,
      depth,
      reason: !customArchetypeSupported ? `runtime supports fresh ${flowId} entry mode '${entryModeName}' at depth '${depth}'` : `runtime supports custom flow '${flowId}' via '${customArchetype}' archetype entry mode '${entryModeName}' at depth '${depth}'`
    };
  }
  const hasCheckpoint = input.flow.steps.some((step) => step.kind === "checkpoint");
  if ((depth === "deep" || depth === "tournament") && hasCheckpoint) {
    return {
      kind: "unsupported",
      flowId,
      entryModeName,
      depth,
      reason: `checkpoint-waiting depth '${depth}' is not supported for this flow`
    };
  }
  return {
    kind: "unsupported",
    flowId,
    entryModeName,
    depth,
    reason: `fresh ${flowId} entry mode '${entryModeName}' at depth '${depth}' is not supported`
  };
}
async function main(argv, options = {}) {
  if (argv[0] === "version") {
    return runVersionCommand(argv.slice(1));
  }
  if (argv[0] === "handoff") {
    return runHandoffCommand(argv.slice(1), {
      ...options.now === void 0 ? {} : { now: options.now }
    });
  }
  if (argv[0] === "create") {
    return runCreateCommand(argv.slice(1), {
      ...options.now === void 0 ? {} : { now: options.now }
    });
  }
  if (argv[0] === "runs") {
    return runRunsCommand(argv.slice(1));
  }
  let args;
  try {
    args = parseArgs3(argv);
  } catch (err) {
    process.stderr.write(`error: ${err.message}
`);
    return 2;
  }
  if (args.command === "resume" && args.runFolder !== void 0 && args.checkpointChoice !== void 0) {
    const runFolder2 = resolve12(args.runFolder);
    const progress2 = progressReporter(args.progress === "jsonl");
    if (await isRuntimeRunFolder(runFolder2)) {
      const runtimeResult = await resumeCompiledFlow({
        runDir: runFolder2,
        selection: args.checkpointChoice,
        now: options.now ?? (() => /* @__PURE__ */ new Date()),
        childCompiledFlowResolver: defaultChildCompiledFlowResolver(void 0),
        ...options.runtimeExecutors === void 0 ? {} : { executors: options.runtimeExecutors },
        ...options.relayer === void 0 ? {} : { relayer: options.relayer },
        ...progress2 === void 0 ? {} : { progress: progress2 }
      });
      const runResult = RunResult.parse(JSON.parse(readFileSync25(runtimeResult.resultPath, "utf8")));
      const priorRoute = readPriorRoute(runFolder2);
      const operatorSummary = writeOperatorSummary({
        runFolder: runFolder2,
        runResult,
        route: {
          selectedFlow: runResult.flow_id,
          ...priorRoute.routedBy === void 0 ? {} : { routedBy: priorRoute.routedBy },
          ...priorRoute.routerReason === void 0 ? {} : { routerReason: priorRoute.routerReason }
        }
      });
      const resumeRuntimeFields = showRuntimeDecision() ? {
        runtime_reason: RUNTIME_POLICY_REASONS.checkpointResume
      } : {};
      process.stdout.write(`${JSON.stringify({
        schema_version: 1,
        run_id: runResult.run_id,
        flow_id: runResult.flow_id,
        run_folder: runFolder2,
        outcome: runResult.outcome,
        trace_entries_observed: runResult.trace_entries_observed,
        result_path: runtimeResult.resultPath,
        ...resumeRuntimeFields,
        operator_summary_path: operatorSummary.jsonPath,
        operator_summary_markdown_path: operatorSummary.markdownPath,
        ...operatorSummary.summary.status_text === void 0 ? {} : { operator_summary_status_text: operatorSummary.summary.status_text },
        ...operatorSummary.htmlPath === void 0 ? {} : { operator_summary_html_path: operatorSummary.htmlPath }
      }, null, 2)}
`);
      return 0;
    }
    process.stderr.write("error: run folder is not a resumable Circuit run folder\n");
    return 2;
  }
  if (args.goal === void 0) {
    throw new Error("internal error: --goal missing outside checkpoint resume mode");
  }
  const route = resolveCompiledFlowRoute(args);
  const entryModeSelection = resolveEntryModeSelection(args, route);
  const fixturePath = resolveFixturePath(route.flowName, entryModeSelection.entryModeName, args.fixturePath, args.flowRoot);
  const { flow, bytes } = loadFixture(fixturePath);
  assertFixtureMatchesRoute(flow, route);
  const runId = RunId.parse(options.runId ?? randomUUID7());
  const now = options.now ?? (() => /* @__PURE__ */ new Date());
  const progress = progressReporter(args.progress === "jsonl");
  const selectedStatusText = routeSelectedStatusText(flow.id, entryModeSelection.entryModeName);
  progress?.({
    schema_version: 1,
    type: "route.selected",
    run_id: runId,
    flow_id: flow.id,
    recorded_at: now().toISOString(),
    label: `Selected ${route.flowName}`,
    display: progressDisplay(`Circuit: ${selectedStatusText}`, "major", "info"),
    presentation: progressPresentation({ blockId: runId, statusText: selectedStatusText }),
    selected_flow: flow.id,
    routed_by: route.source,
    router_reason: route.reason,
    ...route.matched_signal === void 0 ? {} : { router_signal: route.matched_signal },
    ...entryModeSelection.entryModeName === void 0 ? {} : { entry_mode: entryModeSelection.entryModeName },
    ...entryModeSelection.source === void 0 ? {} : { entry_mode_source: entryModeSelection.source }
  });
  const runFolder = resolve12(args.runFolder ?? `${DEFAULT_RUNS_BASE}/${runId}`);
  const selectionConfigLayers = discoverConfigLayers({
    ...options.configHomeDir !== void 0 ? { homeDir: options.configHomeDir } : {},
    ...options.configCwd !== void 0 ? { cwd: options.configCwd } : {}
  });
  const projectRoot = resolve12(options.configCwd ?? process.cwd());
  const runtimeSupport = classifyRuntimeSupport({ flow, args, entryModeSelection, fixturePath });
  const runtimeDecisionDiagnostics = showRuntimeDecision();
  const defaultRuntimeSupport = applyComposeWriterPolicy(applyFixturePolicy(runtimeSupport, {
    args,
    fixturePath
  }), { hasComposeWriter: options.composeWriter !== void 0 });
  const routeToRuntime = defaultRuntimeSupport.kind === "supported";
  if (routeToRuntime) {
    const runtimeResult = await runCompiledFlowWithWaiting({
      flowBytes: bytes,
      runDir: runFolder,
      runId,
      goal: args.goal,
      now,
      projectRoot,
      childCompiledFlowResolver: defaultChildCompiledFlowResolver(args.flowRoot),
      ...args.depth === void 0 ? {} : { depth: args.depth },
      ...entryModeSelection.entryModeName === void 0 ? {} : { entryModeName: entryModeSelection.entryModeName },
      ...options.relayer === void 0 ? {} : { relayer: options.relayer },
      ...options.runtimeExecutors === void 0 ? {} : { executors: options.runtimeExecutors },
      ...selectionConfigLayers.length === 0 ? {} : { selectionConfigLayers },
      ...progress === void 0 ? {} : { progress },
      ...args.includeUntrackedContent ? { evidencePolicy: { includeUntrackedFileContent: true } } : {}
    });
    if (isGraphCheckpointWaitingResult(runtimeResult)) {
      const waitingResult = {
        schema_version: 1,
        run_id: RunId.parse(runtimeResult.runId),
        flow_id: CompiledFlowId.parse(runtimeResult.flowId),
        goal: args.goal,
        outcome: "checkpoint_waiting",
        summary: `checkpoint '${runtimeResult.checkpoint.stepId}' is waiting for an operator choice.`,
        trace_entries_observed: runtimeResult.traceEntriesObserved,
        manifest_hash: computeManifestHash(bytes),
        checkpoint: {
          step_id: runtimeResult.checkpoint.stepId,
          request_path: runtimeResult.checkpoint.requestPath,
          allowed_choices: runtimeResult.checkpoint.allowedChoices
        }
      };
      const operatorSummary2 = writeOperatorSummary({
        runFolder,
        runResult: waitingResult,
        route: {
          selectedFlow: route.flowName,
          routedBy: route.source,
          routerReason: route.reason
        }
      });
      process.stdout.write(`${JSON.stringify({
        schema_version: 1,
        run_id: waitingResult.run_id,
        flow_id: waitingResult.flow_id,
        selected_flow: route.flowName,
        routed_by: route.source,
        router_reason: route.reason,
        ...route.matched_signal === void 0 ? {} : { router_signal: route.matched_signal },
        ...entryModeSelection.entryModeName === void 0 ? {} : { entry_mode: entryModeSelection.entryModeName },
        ...entryModeSelection.source === void 0 ? {} : { entry_mode_source: entryModeSelection.source },
        run_folder: runFolder,
        outcome: waitingResult.outcome,
        trace_entries_observed: waitingResult.trace_entries_observed,
        ...runtimeOutputFields({
          include: runtimeDecisionDiagnostics,
          decision: defaultRuntimeSupport
        }),
        operator_summary_path: operatorSummary2.jsonPath,
        operator_summary_markdown_path: operatorSummary2.markdownPath,
        ...operatorSummary2.summary.status_text === void 0 ? {} : { operator_summary_status_text: operatorSummary2.summary.status_text },
        ...operatorSummary2.htmlPath === void 0 ? {} : { operator_summary_html_path: operatorSummary2.htmlPath },
        checkpoint: waitingResult.checkpoint
      }, null, 2)}
`);
      return 0;
    }
    const runResult = RunResult.parse(JSON.parse(readFileSync25(runtimeResult.resultPath, "utf8")));
    const operatorSummary = writeOperatorSummary({
      runFolder,
      runResult,
      route: {
        selectedFlow: route.flowName,
        routedBy: route.source,
        routerReason: route.reason
      }
    });
    process.stdout.write(`${JSON.stringify({
      schema_version: 1,
      run_id: runResult.run_id,
      flow_id: runResult.flow_id,
      selected_flow: route.flowName,
      routed_by: route.source,
      router_reason: route.reason,
      ...route.matched_signal === void 0 ? {} : { router_signal: route.matched_signal },
      ...entryModeSelection.entryModeName === void 0 ? {} : { entry_mode: entryModeSelection.entryModeName },
      ...entryModeSelection.source === void 0 ? {} : { entry_mode_source: entryModeSelection.source },
      run_folder: runFolder,
      outcome: runResult.outcome,
      trace_entries_observed: runResult.trace_entries_observed,
      result_path: runtimeResult.resultPath,
      ...runtimeOutputFields({
        include: runtimeDecisionDiagnostics,
        decision: defaultRuntimeSupport
      }),
      operator_summary_path: operatorSummary.jsonPath,
      operator_summary_markdown_path: operatorSummary.markdownPath,
      ...operatorSummary.summary.status_text === void 0 ? {} : { operator_summary_status_text: operatorSummary.summary.status_text },
      ...operatorSummary.htmlPath === void 0 ? {} : { operator_summary_html_path: operatorSummary.htmlPath }
    }, null, 2)}
`);
    return 0;
  }
  process.stderr.write(`error: unsupported runtime invocation: ${defaultRuntimeSupport.reason}
`);
  return 2;
}
var invokedDirectly = process.argv[1] !== void 0 && (import.meta.url === `file://${process.argv[1]}` || import.meta.url.endsWith(process.argv[1].split("/").pop() ?? ""));
if (invokedDirectly) {
  main(process.argv.slice(2)).then((code) => process.exit(code), (err) => {
    process.stderr.write(`error: ${err instanceof Error ? err.message : String(err)}
`);
    process.exit(1);
  });
}
export {
  main,
  usage3 as usage
};
