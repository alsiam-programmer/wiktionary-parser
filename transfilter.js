const fs = require("fs");
const readline = require("readline");

const LANGS = require("./langs.json");

const INPUT_FILE = "./data/filter/dictionary.ndjson";
const OUTPUT_FILE = "./data/filter/dictionary(main).ndjson";

const rl = readline.createInterface({
    input: fs.createReadStream(INPUT_FILE, {
        encoding: "utf8",
    }),
    crlfDelay: Infinity,
});

const output = fs.createWriteStream(OUTPUT_FILE, {
    flags: "w",
});

function extractWords(text = "") {
    const regex =
        /\{\{(?:t|tt)(?:-check|-needed)?\+?\|[^|]+\|([^|}]+)/g;

    const words = new Set();
    let match;

    while ((match = regex.exec(text)) !== null) {
        words.add(match[1].trim());
    }

    return [...words];
}

let processed = 0;
let written = 0;
let skipped = 0;
let parseErrors = 0;

rl.on("line", (line) => {
    if (!line.trim()) return;

    processed++;

    let doc;

    try {
        doc = JSON.parse(line);
    } catch {
        parseErrors++;
        return;
    }

    // Skip if translations is missing or empty
    if (
        !doc.translations ||
        typeof doc.translations !== "object" ||
        Object.keys(doc.translations).length === 0
    ) {
        skipped++;
        return;
    }

    const translations = {};

    for (const lang of LANGS) {
        translations[lang.name] = [];
    }

    let foundTranslation = false;

    for (const [langName, value] of Object.entries(doc.translations)) {
        if (typeof value !== "string") continue;

        const cleanName = langName.replace(/^\*\s*/, "").trim();
        const words = extractWords(value);

        if (
            words.length &&
            Object.prototype.hasOwnProperty.call(
                translations,
                cleanName
            )
        ) {
            translations[cleanName] = words;
            foundTranslation = true;
        }
    }

    // Skip if no valid translations extracted
    if (!foundTranslation) {
        skipped++;
        return;
    }

    const result = {
        word: doc.word || "",
        pos: Array.isArray(doc.pos) ? doc.pos : [],
        definitions: Array.isArray(doc.definitions)
            ? doc.definitions
            : [],
        ipa: doc.ipa || "",
        synonyms: Array.isArray(doc.synonyms)
            ? doc.synonyms
            : [],
        translations,
    };

    output.write(JSON.stringify(result) + "\n");
    written++;

    if (processed % 1000 === 0) {
        console.log(
            `[${processed}] Written: ${written} | Skipped: ${skipped} | Parse Errors: ${parseErrors}`
        );
    }
});

rl.on("close", () => {
    output.end();

    console.log("\n========== DONE ==========");
    console.log(`Processed    : ${processed}`);
    console.log(`Written      : ${written}`);
    console.log(`Skipped      : ${skipped}`);
    console.log(`Parse Errors : ${parseErrors}`);
    console.log(`Output       : ${OUTPUT_FILE}`);
    console.log("==========================");
});