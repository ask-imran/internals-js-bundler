const fs = require('fs');
const babylon = require('babylon');
const path = require('path');
const babel = require('@babel/core');
const traverse = require('babel-traverse').default; //We can't use import statements here, unless the type is mentioned as module in package.json

let ID = 0;

function getAST(filename) {
  let fileContent = fs.readFileSync(filename, 'utf-8'); //We need the formatting to be specified or else we'll be receving a binaries
  let ast = babylon.parse(fileContent, { sourceType: 'module' }); //sourceType has to be module since import and export statements are used
  return ast;
}

function createAsset(filename) {
  const ast = getAST(filename);
  let dependencies = [];
  traverse(ast, {
    ImportDeclaration: ({ node }) => {
      dependencies.push(node.source.value);
    },
  });
  const { code } = babel.transformFromAst(ast, null, {
    presets: ['env'],
  });
  const id = ID++;
  return {
    id,
    filename,
    dependencies,
    mapping: {},
    code,
  };
}

function createGraph() {
  const mainAsset = createAsset('./src/app.js');
  let assets = [];
  assets.push(mainAsset);
  for (asset of assets) {
    asset.dependencies.forEach((realtivePath) => {
      const dir = path.dirname(asset.filename);
      let absolutePath = path.join(dir, realtivePath);
      let childAsset = createAsset(absolutePath);
      asset.mapping[realtivePath] = childAsset.id;
      assets.push(childAsset);
    });
  }
  return assets;
}

function generateBundleScript() {
  const modules = createGraph();
  let code = '';
  modules.forEach((mod) => {
    code += `${mod.id}:[function(require, exports)
                    {
                      ${mod.code}
                    },
                    ${JSON.stringify(mod.mapping)}
                  ],`;
  });

  var result = `(function (modules) {
    function require(id) {
      const [fn, mapping] = modules[id];

      function localRequire(path) {
        return require(mapping[path]);
      }
      const module = { exports: {} };

      fn(localRequire, module.exports);
      return module.exports;
    }
    require(0);
  })({ ${code} });`;

  return result;
}

var jsText = generateBundleScript();
console.log(jsText);
