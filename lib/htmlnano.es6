import posthtml from 'posthtml';
import { cosmiconfigSync } from 'cosmiconfig';
import safePreset from './presets/safe';
import ampSafePreset from './presets/ampSafe';
import maxPreset from './presets/max';
import packageJson from '../package.json';

const presets = {
    safe: safePreset,
    ampSafe: ampSafePreset,
    max: maxPreset,
};

export function loadConfig(options, preset, configPath) {
    if (!options?.skipConfigLoading) {
        const explorer = cosmiconfigSync(packageJson.name);
        const rc = configPath ? explorer.load(configPath) : explorer.search();
        if (rc) {
            const { preset: presetName } = rc.config;
            if (presetName) {
                if (!preset && presets[presetName]) {
                    preset = presets[presetName];
                }

                delete rc.config.preset;
            }

            if (!options) {
                options = rc.config;
            }
        }
    }

    return [
        options || {},
        preset || safePreset,
    ];
}

const optionalDependencies = {
    minifyCss: ['cssnano', 'postcss'],
    minifyJs: ['terser'],
    minifyUrl: ['relateurl', 'srcset', 'terser'],
    minifySvg: ['svgo'],
};

function htmlnano(optionsRun, presetRun) {
    let [options, preset] = loadConfig(optionsRun, presetRun);

    return function minifier(tree) {
        const nodeHandlers = [];
        const attrsHandlers = [];
        const contentsHandlers = [];

        options = { ...preset, ...options };
        let promise = Promise.resolve(tree);

        for (const [moduleName, moduleOptions] of Object.entries(options)) {
            if (!moduleOptions) {
                // The module is disabled
                continue;
            }

            if (safePreset[moduleName] === undefined) {
                throw new Error('Module "' + moduleName + '" is not defined');
            }

            (optionalDependencies[moduleName] || []).forEach(dependency => {
                try {
                    require(dependency);
                } catch (e) {
                    if (e.code === 'MODULE_NOT_FOUND') {
                        console.warn(`You have to install "${dependency}" in order to use htmlnano's "${moduleName}" module`);
                    } else {
                        throw e;
                    }
                }
            });

            const module = require('./modules/' + moduleName);

            if (module.onAttrs) {
                attrsHandlers.push(module.onAttrs(options, moduleOptions));
            }
            if (module.onContent) {
                contentsHandlers.push(module.onContent(options, moduleOptions));
            }
            if (module.onNode) {
                nodeHandlers.push(module.onNode(options, moduleOptions));
            }
            if (module.default) {
                promise = promise.then(tree => module.default(tree, options, moduleOptions));
            }
        }

        if (attrsHandlers.length + contentsHandlers.length + nodeHandlers.length === 0) {
            return promise;
        }

        return promise.then(tree => {
            tree.walk(node => {
                if (node.attrs) {
                    // Convert all attrs' key to lower case
                    let newAttrsObj = {};
                    Object.entries(node.attrs).forEach(([attrName, attrValue]) => {
                        newAttrsObj[attrName.toLowerCase()] = attrValue;
                    });

                    for (const handler of attrsHandlers) {
                        newAttrsObj = handler(newAttrsObj, node);
                    }

                    node.attrs = newAttrsObj;
                }

                if (node.content) {
                    for (const handler of contentsHandlers) {
                        node.content = handler(node.content, node);
                    }
                }

                for (const handler of nodeHandlers) {
                    node = handler(node, node);
                }

                return node;
            });

            return tree;
        });
    };
}

htmlnano.getRequiredOptionalDependencies = function (optionsRun, presetRun) {
    const [options] = loadConfig(optionsRun, presetRun);

    return [...new Set(Object.keys(options).filter(moduleName => options[moduleName]).map(moduleName => optionalDependencies[moduleName]).flat())];
};


htmlnano.process = function (html, options, preset, postHtmlOptions) {
    return posthtml([htmlnano(options, preset)])
        .process(html, postHtmlOptions);
};

htmlnano.presets = presets;

export default htmlnano;
