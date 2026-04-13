const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');
const JavaScriptObfuscator = require('javascript-obfuscator');

const srcDir = __dirname;
const destDir = path.join(__dirname, 'deploy_secure');

if (fs.existsSync(destDir)) {
    fs.rmSync(destDir, { recursive: true, force: true });
}
fs.mkdirSync(destDir, { recursive: true });

const obfOptions = {
    compact: true,
    controlFlowFlattening: true,
    controlFlowFlatteningThreshold: 0.75,
    deadCodeInjection: true,
    deadCodeInjectionThreshold: 0.4,
    debugProtection: false,
    disableConsoleOutput: true,
    identifierNamesGenerator: 'hexadecimal',
    log: false,
    numbersToExpressions: true,
    renameGlobals: false,
    selfDefending: false,
    simplify: true,
    splitStrings: false,
    splitStringsChunkLength: 10,
    stringArray: true,
    stringArrayCallsTransform: true,
    stringArrayCallsTransformThreshold: 0.5,
    stringArrayEncoding: ['base64'],
    stringArrayIndexShift: true,
    stringArrayRotate: true,
    stringArrayShuffle: true,
    stringArrayWrappersCount: 1,
    stringArrayWrappersChainedCalls: true,
    stringArrayWrappersParametersMaxCount: 2,
    stringArrayWrappersType: 'variable',
    stringArrayThreshold: 0.75,
    unicodeEscapeSequence: false
};

const securityContent = "\n" +
"(function(){\n" +
"    document.addEventListener('contextmenu', e => e.preventDefault());\n" +
"    document.addEventListener('keydown', e => {\n" +
"        if(e.keyCode === 123 || \n" +
"           (e.ctrlKey && e.shiftKey && (e.keyCode === 73 || e.keyCode === 74 || e.keyCode === 67)) || \n" +
"           (e.ctrlKey && e.keyCode === 85) || \n" +
"           (e.ctrlKey && e.keyCode === 83) || \n" +
"           (e.ctrlKey && e.keyCode === 67) \n" +
"        ) {\n" +
"            e.preventDefault();\n" +
"        }\n" +
"    });\n" +
"    document.addEventListener('copy', e => {\n" +
"        e.preventDefault();\n" +
"    });\n" +
"})();\n";
fs.writeFileSync(path.join(destDir, 'security.js'), securityContent, 'utf-8');

function copyFolderSync(from, to) {
    fs.mkdirSync(to, { recursive: true });
    fs.readdirSync(from).forEach(element => {
        if (fs.lstatSync(path.join(from, element)).isFile()) {
            fs.copyFileSync(path.join(from, element), path.join(to, element));
        } else {
            copyFolderSync(path.join(from, element), path.join(to, element));
        }
    });
}

function processDirectory(src, dest) {
    // Sadece bulunduğumuz klasördeki dosyaları tara (ve gereksizleri/sonsuz döngü yaratacakları yoksay)
    // Dosyalar normal obfuscation listesine alınır
    const ignores = ['node_modules', '.git', 'deploy_secure', 'package.json', 'package-lock.json', 'build_secure.js', '.vercel', 'verify'];
    // Bu dosyalar PDF export içinde HTML template üretir, obfuscator bozuyor — sadece kopyala
    const copyOnly = ['app-mobilizasyon.html', 'app-trenchcalc.html', 'app-makenik.html'];
    
    fs.readdirSync(src).forEach(file => {
        if (ignores.includes(file)) return;
        
        const srcPath = path.join(src, file);
        const destPath = path.join(dest, file);

        if (fs.statSync(srcPath).isDirectory()) {
            fs.mkdirSync(destPath, { recursive: true });
            copyFolderSync(srcPath, destPath);
        } else {
            const ext = path.extname(file).toLowerCase();

            // copyOnly listesindeki dosyaları obfuscate etme, direkt kopyala
            if (copyOnly.includes(file)) {
                fs.copyFileSync(srcPath, destPath);
                console.log('Kopyalandı (obfuscation yok):', file);
                return;
            }

            if (ext === '.html') {
                let html = fs.readFileSync(srcPath, 'utf-8');
                const $ = cheerio.load(html);

                if ($('style').length === 0) {
                    $('head').append('<style></style>');
                }
                const securityCSS = "\n" +
                "* { -webkit-user-select: none; -moz-user-select: none; -ms-user-select: none; user-select: none; }\n" +
                "input, textarea, [contenteditable] { -webkit-user-select: auto; -moz-user-select: auto; -ms-user-select: auto; user-select: auto; }\n" +
                "img, svg, canvas { -webkit-user-drag: none; pointer-events: none; }\n" +
                ".unit, .unit-rot, .unit-del, canvas, button { pointer-events: auto !important; }\n";
                
                $('head').append("<style>" + securityCSS + "</style>");

                $('body').append('<script src="security.js"></script>');

                $('script').each((i, el) => {
                    const srcAttr = $(el).attr('src');
                    const typeAttr = $(el).attr('type');
                    
                    if (!srcAttr && typeAttr !== 'module' && typeAttr !== 'importmap') {
                        const rawJS = $(el).html();
                        if (rawJS && rawJS.trim().length > 10) {
                            try {
                                const obfResult = JavaScriptObfuscator.obfuscate(rawJS, obfOptions);
                                let safeCode = obfResult.getObfuscatedCode();
                                safeCode = safeCode.replace(/<\/script>/ig, '<\\/script>');
                                $(el).html(safeCode);
                            } catch (e) {
                                console.error('Obfuscation error in:', file, e);
                            }
                        }
                    }
                });

                fs.writeFileSync(destPath, $.html(), 'utf-8');
                console.log('Secure (HTML):', file);

            } else if (ext === '.js') {
                let rawJS = fs.readFileSync(srcPath, 'utf-8');
                try {
                    let customOpts = { ...obfOptions };
                    if (rawJS.includes('export ') || rawJS.includes('import ')) {
                        customOpts.renameGlobals = false;
                        customOpts.controlFlowFlattening = false;
                    }
                    const obfResult = JavaScriptObfuscator.obfuscate(rawJS, customOpts);
                    fs.writeFileSync(destPath, obfResult.getObfuscatedCode(), 'utf-8');
                    console.log('Secure (JS):', file);
                } catch (e) {
                    console.error('Obfuscation error in JS:', file, e);
                    fs.writeFileSync(destPath, rawJS, 'utf-8');
                }
            } else {
                fs.copyFileSync(srcPath, destPath);
            }
        }
    });
}

console.log('--- Vercel Securing Process Started ---');
processDirectory(srcDir, destDir);
console.log('--- Output generated in deploy_secure ---');
