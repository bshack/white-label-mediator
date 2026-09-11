'use strict';
const fs = require('node:fs');

function update(file, transform) {
    const before = fs.readFileSync(file, 'utf8');
    const after = transform(before);
    if (after === before) throw new Error(`Expected compatibility changes were not found in ${file}`);
    fs.writeFileSync(file, after);
}

update('README.md', source => {
    const marker = '## Install and import\n';
    if (!source.includes(marker)) throw new Error('README install marker not found');
    source = source.replace(marker,
        '## Versioning policy\n\nBackward compatibility is not maintained through obsolete distribution formats, aliases, deprecated signatures, or runtime shims. Breaking public API or supported-distribution changes are communicated with a Semantic Versioning major release and documented migration notes.\n\n### Version 4 migration\n\nBower/AMD package metadata has been removed. Install `white-label-mediator` through npm and consume the documented CommonJS/ESM-compatible package entrypoint with a modern Node or browser-bundler toolchain. No Bower compatibility metadata is retained.\n\n' + marker
    );
    source = source.replace('## TypeScript development and version 3.0.0 migration', '## TypeScript development');
    return source;
});

update('package.json', source => {
    const data = JSON.parse(source);
    if (data.version !== '3.1.0') throw new Error(`Unexpected package version ${data.version}`);
    data.version = '4.0.0';
    return JSON.stringify(data, null, 2) + '\n';
});
