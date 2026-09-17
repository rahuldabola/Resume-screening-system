"""
A curated skills taxonomy used for keyword-based skill extraction.

Each skill maps to a list of surface forms (aliases) that might appear in
free text, so extraction is robust to common variants ("js" vs "javascript").
Keeping this as a flat, explicit taxonomy (rather than a trained NER model)
is a deliberate tradeoff for this project's scope: it's fast, fully
deterministic, has zero training-data requirements, and is easy to extend.

Naive keyword matching has two failure modes that this module handles
explicitly, because both produce *false positives* -- the expensive kind of
error when the output is a hiring shortlist:

1. **Ambiguous aliases.** Several real skill names are also ordinary English
   words: "go", "ml", "express", "node", "ts". A plain word-boundary match
   reads "I go above and beyond to express our values" as Go + Express, and
   "500 ml of reagent" as machine learning. Aliases listed in
   `AMBIGUOUS_ALIASES` therefore only count when the surrounding text
   supports a technical reading (see `_has_technical_support`).

2. **Negation.** "No professional Python experience" and "never used Docker"
   both contain the skill keyword while asserting its absence. Mentions
   governed by a negated capability phrase are discarded (see
   `_negated_regions`).

`find_skill_mentions` is the primitive: it returns every accepted mention
with its character span, which lets callers do more than set membership --
`app.scoring` uses the spans to measure how much of a document is nothing
but keywords (keyword-stuffing detection).
"""

import re
from dataclasses import dataclass

SKILLS_TAXONOMY = {
    # ---- languages ----
    "python": ["python"],
    "javascript": ["javascript", "js", "es6", "ecmascript"],
    "typescript": ["typescript", "ts"],
    "java": ["java"],
    "c++": ["c++", "cpp"],
    "c#": ["c#", "csharp"],
    "go": ["golang", "go"],
    "sql": ["sql"],
    "r": ["r programming", "r language"],

    # ---- frontend ----
    "react": ["react.js", "reactjs", "react"],
    "vue": ["vue.js", "vuejs", "vue"],
    "angular": ["angular"],
    "html": ["html", "html5"],
    "css": ["css", "css3", "tailwind", "sass", "scss"],
    "redux": ["redux"],
    "next.js": ["next.js", "nextjs"],

    # ---- backend ----
    "node.js": ["node.js", "nodejs", "node"],
    "express": ["express.js", "expressjs", "express"],
    "django": ["django"],
    "flask": ["flask"],
    "fastapi": ["fastapi"],
    "spring boot": ["spring boot", "spring framework"],
    "rest api": ["rest api", "restful api", "rest apis"],
    "graphql": ["graphql"],
    "microservices": ["microservices", "microservice architecture"],

    # ---- data / ml ----
    "machine learning": ["machine learning", "ml models", "ml"],
    "deep learning": ["deep learning"],
    "scikit-learn": ["scikit-learn", "sklearn"],
    "tensorflow": ["tensorflow"],
    "pytorch": ["pytorch"],
    "pandas": ["pandas"],
    "numpy": ["numpy"],
    "nlp": ["nlp", "natural language processing"],
    "data analysis": ["data analysis", "data analytics"],
    "feature engineering": ["feature engineering"],
    "model evaluation": ["model evaluation", "cross-validation", "hyperparameter tuning"],

    # ---- databases ----
    "postgresql": ["postgresql", "postgres"],
    "mysql": ["mysql"],
    "mongodb": ["mongodb", "mongo db"],
    "redis": ["redis"],
    "sqlite": ["sqlite"],

    # ---- devops / cloud ----
    "docker": ["docker", "containerization"],
    "kubernetes": ["kubernetes", "k8s"],
    "aws": ["aws", "amazon web services", "ec2"],
    "azure": ["azure"],
    "gcp": ["gcp", "google cloud"],
    "ci/cd": ["ci/cd", "continuous integration", "continuous deployment", "jenkins", "github actions"],
    "linux": ["linux"],
    "git": ["git", "github", "version control"],

    # ---- product / business ----
    "sales": ["sales", "quota attainment", "b2b sales"],
    "marketing": ["marketing", "seo", "content strategy", "campaign management"],
    "project management": ["project management", "agile", "scrum", "jira"],
    "accounting": ["accounting", "bookkeeping", "financial reporting", "gaap"],
    "customer support": ["customer support", "customer service", "help desk"],
    "graphic design": ["graphic design", "adobe photoshop", "adobe illustrator", "figma"],
}

# Aliases that are also ordinary English words. A match on one of these only
# counts if the immediate neighbourhood reads as technical -- see
# `_has_technical_support`.
#
# "js" is deliberately absent: standalone "JS" is never ordinary English, and
# its only real false positive -- the tail of "node.js" / "react.js" -- is
# handled structurally by the dotted-token guard in `_alias_pattern`.
AMBIGUOUS_ALIASES = frozenset({"go", "ml", "express", "node", "ts"})

# Skills that are real, but say nothing about whether a *technical* reading of
# a nearby ambiguous alias is plausible. Without this, "Sales leader. I go
# above and beyond" resolves "go" to Go, because "sales" sits next to it.
NON_TECHNICAL_SKILLS = frozenset({
    "sales", "marketing", "project management", "accounting",
    "customer support", "graphic design",
})

# Aliases containing only symbol characters at their boundary (e.g. "c++",
# "c#") don't work with \b word-boundary regex, since \b only fires at a
# transition between a word character and a non-word one. These few are
# matched with plain substring search instead.
_SYMBOL_ALIASES = frozenset({"c++", "c#", "ci/cd"})

# Words whose presence near an ambiguous alias makes the technical reading the
# likely one. Deliberately generic -- this is a disambiguation prior, not a
# second taxonomy -- but it excludes filler common to every register of
# English, which is why "experience" is here and "with" is not.
_TECHNICAL_CUE = re.compile(
    r"\b(?:developer|developers|engineer|engineers|engineering|programming|programmer"
    r"|language|languages|framework|frameworks|library|libraries|runtime|backend|back-end"
    r"|frontend|front-end|fullstack|full-stack|stack|api|apis|endpoint|endpoints"
    r"|microservices|microservice|server|servers|serverless|software|application|applications"
    r"|codebase|deployed|deploy|deployment|built|building|using|skills|skilled|proficient"
    r"|proficiency|experience|experienced|expertise|technologies|technology|tooling"
    r"|pipeline|pipelines|database|databases|querying|scripting|models|containers|container"
    r"|cluster|clusters|repository|repositories|testing|debugging)\b"
)

# How far either side of an ambiguous mention we look for technical support.
# Deliberately tight: a whole-sentence window lets one stray "experience" in a
# sales resume validate an unrelated "go".
_SUPPORT_WINDOW = 25

# A number written directly onto an ambiguous alias makes it a quantity, and
# the technical-support test cannot see that -- it is exactly the sentences
# that count infrastructure which are densest in technical cues. "Ran a 40-node
# Kubernetes cluster" sizes a cluster; "Dispensed 250 ml samples using
# automated testing equipment" measures a liquid. Both scored a skill the
# resume never claimed, propped up by the real technical words beside them.
#
# Only the digit-hyphen compound is treated as a quantity on its own, because
# it is never anything else. A digit and a space is not enough: "Built 3 Go
# services" is an ordinary way to write a real claim.
_QUANTITY_COMPOUND = re.compile(r"\d\s*-\s*$")

# Aliases that are also units of measure, where a bare number in front is a
# measurement. Capitalisation decides it: nobody writes "500 ML of reagent",
# and nobody writes "5 ml models" -- so "5 ML models" survives this and
# "250 ml samples" does not.
_UNIT_ALIASES = frozenset({"ml"})
_UNIT_QUANTITY = re.compile(r"\d\s*$")

# Enough left context to see a quantity and its separator, and no more.
_QUANTITY_LOOKBEHIND = 6

# A capability the writer is asserting they *do not* have. Matches phrases
# like "no professional Python experience", "never used Docker", "without
# Kubernetes exposure" -- a negation word followed, within a few words, by a
# capability noun or verb.
_NEGATED_CAPABILITY = re.compile(
    r"\b(?:no|not|never|without|lacks|lack|lacking|zero|minimal|little)\b"
    r"(?:\s+[\w.+#/-]+){0,3}?\s+"
    r"(?:experience|exposure|background|knowledge|familiarity|understanding"
    r"|proficiency|used|use|using|worked|work|touched|written|wrote)\b"
)

# A negated phrase governs the skill names that follow it, but only to the end
# of the clause -- "Never used Docker. Kubernetes in production for 3 years"
# must not strip Kubernetes.
#
# A contrast conjunction ends that reach just as firmly as punctuation does.
# "No Python experience, but 8 years of Kubernetes" denies Python and claims
# Kubernetes; without `but` here the 45-character reach runs straight through
# the contrast and drops a skill the candidate does have. That is a false
# negative, and unlike the false positives this module is built around, it
# leaves no trace on screen -- the skill is simply absent.
#
# It is the conjunction that is matched, never the comma before it: a bare
# comma must not break, because "no experience with Python, Django or Flask"
# denies all three. "aside from"/"other than" single a skill *out* of a denial
# ("no backend experience other than Flask" claims Flask), so they break too.
_NEGATION_REACH = 45
_CLAUSE_BREAK = re.compile(
    r"[.;!?\n]"
    r"|\b(?:but|although|though|however|whereas|aside from|apart from|other than)\b"
)


@dataclass(frozen=True)
class SkillMention:
    """One accepted occurrence of a taxonomy skill in a document."""

    skill: str
    alias: str
    start: int
    end: int


def _alias_pattern(alias: str) -> "re.Pattern[str]":
    # The leading `(?<!\.)` stops an alias from matching the tail of a dotted
    # token: without it `\bjs\b` fires inside "node.js" and "react.js", and
    # every resume mentioning those picks up a JavaScript claim it never made.
    return re.compile(r"(?<!\.)\b" + re.escape(alias) + r"\b")


_COMPILED_PATTERNS = {
    skill: [
        (alias, None if alias in _SYMBOL_ALIASES else _alias_pattern(alias))
        for alias in aliases
    ]
    for skill, aliases in SKILLS_TAXONOMY.items()
}


def _negated_regions(lowered: str) -> list[tuple[int, int]]:
    """Character ranges in which a skill mention is being denied, not claimed."""
    regions = []
    for match in _NEGATED_CAPABILITY.finditer(lowered):
        reach_end = match.end() + _NEGATION_REACH
        clause_end = _CLAUSE_BREAK.search(lowered, match.end(), reach_end)
        regions.append((match.start(), clause_end.start() if clause_end else reach_end))
    return regions


def _iter_raw_matches(lowered: str):
    """Every alias hit in the document, before ambiguity/negation filtering."""
    for skill, patterns in _COMPILED_PATTERNS.items():
        for alias, pattern in patterns:
            if pattern is None:
                start = lowered.find(alias)
                while start != -1:
                    yield skill, alias, start, start + len(alias)
                    start = lowered.find(alias, start + 1)
            else:
                for match in pattern.finditer(lowered):
                    yield skill, alias, match.start(), match.end()


def _has_technical_support(
    lowered: str, start: int, end: int, unambiguous: list[tuple[int, int]]
) -> bool:
    """True if the text around [start, end) reads as technical.

    Support comes from either a generic technical cue word, or from another
    technical skill mention that needed no disambiguation ("Node.js and
    Express" props up "Express"; "I go above and beyond" props up nothing).
    """
    window_start = max(0, start - _SUPPORT_WINDOW)
    window_end = min(len(lowered), end + _SUPPORT_WINDOW)

    if _TECHNICAL_CUE.search(lowered, window_start, window_end):
        return True

    return any(
        other_start < window_end and other_end > window_start
        for other_start, other_end in unambiguous
    )


def find_skill_mentions(text: str) -> list[SkillMention]:
    """Every accepted skill mention in `text`, ordered by position.

    A raw alias hit is accepted unless it sits inside a negated capability
    phrase, or it is an ambiguous alias with no technical support nearby.
    """
    lowered = text.lower()
    negated = _negated_regions(lowered)
    raw = list(_iter_raw_matches(lowered))

    def is_negated(start: int, end: int) -> bool:
        return any(
            region_start <= start and end <= region_end
            for region_start, region_end in negated
        )

    # Pass 1: unambiguous *technical* mentions. These both stand on their own
    # and serve as evidence for pass 2.
    unambiguous_spans = [
        (start, end)
        for skill, alias, start, end in raw
        if alias not in AMBIGUOUS_ALIASES
        and skill not in NON_TECHNICAL_SKILLS
        and not is_negated(start, end)
    ]

    def is_quantity(alias: str, start: int, end: int) -> bool:
        """True if a number in front makes this alias a count or a measurement."""
        before = lowered[max(0, start - _QUANTITY_LOOKBEHIND):start]
        if _QUANTITY_COMPOUND.search(before):
            return True
        return (
            alias in _UNIT_ALIASES
            and _UNIT_QUANTITY.search(before) is not None
            # Read from the source, not `lowered`: the capitals are the signal.
            and not text[start:end].isupper()
        )

    accepted = []
    for skill, alias, start, end in raw:
        if is_negated(start, end):
            continue
        if alias in AMBIGUOUS_ALIASES and (
            is_quantity(alias, start, end)
            or not _has_technical_support(lowered, start, end, unambiguous_spans)
        ):
            continue
        accepted.append(SkillMention(skill=skill, alias=alias, start=start, end=end))

    accepted.sort(key=lambda mention: (mention.start, -mention.end))
    return accepted


def extract_skills(text: str) -> set[str]:
    """Return the set of taxonomy skills `text` credibly claims."""
    return {mention.skill for mention in find_skill_mentions(text)}


def keyword_coverage(text: str) -> float:
    """Fraction of the document's characters taken up by skill keywords.

    Prose about real work stays well under 0.3 even when it is dense with
    technology names, because the keywords are embedded in sentences. A
    document engineered to game a keyword matcher -- a bare comma-separated
    skills dump -- approaches 1.0. `app.scoring` uses this to damp the score of
    documents that are all keyword and no evidence.
    """
    stripped = text.strip()
    if not stripped:
        return 0.0

    # Merge overlapping spans so "node.js" and "node" aren't counted twice.
    merged_length = 0
    current_start = current_end = None
    for mention in find_skill_mentions(text):
        if current_end is not None and mention.start <= current_end:
            current_end = max(current_end, mention.end)
            continue
        if current_end is not None:
            merged_length += current_end - current_start
        current_start, current_end = mention.start, mention.end
    if current_end is not None:
        merged_length += current_end - current_start

    return min(1.0, merged_length / len(stripped))
