"""
A curated skills taxonomy used for keyword-based skill extraction.

Each skill maps to a list of surface forms (aliases) that might appear in
free text, so extraction is robust to common variants ("js" vs "javascript").
Keeping this as a flat, explicit taxonomy (rather than a trained NER model)
is a deliberate, honest tradeoff for this project's scope: it's fast,
fully deterministic, has zero training-data requirements, and is easy to
extend — the same approach real ATS keyword-matching systems use.
"""

import re

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

    # ---- product / business (deliberately non-technical, for mismatch testing) ----
    "sales": ["sales", "quota attainment", "b2b sales"],
    "marketing": ["marketing", "seo", "content strategy", "campaign management"],
    "project management": ["project management", "agile", "scrum", "jira"],
    "accounting": ["accounting", "bookkeeping", "financial reporting", "gaap"],
    "customer support": ["customer support", "customer service", "help desk"],
    "graphic design": ["graphic design", "adobe photoshop", "adobe illustrator", "figma"],
}

# Aliases containing only symbol characters at their boundary (e.g. "c++",
# "c#") don't work with \b word-boundary regex, since \b only fires at a
# transition between a word character and a non-word one. These few are
# matched with plain substring search instead.
_SYMBOL_ALIASES = {"c++", "c#", "ci/cd"}


def _alias_pattern(alias: str) -> "re.Pattern[str]":
    return re.compile(r"\b" + re.escape(alias) + r"\b")


_COMPILED_PATTERNS = {
    skill: [
        alias if alias in _SYMBOL_ALIASES else _alias_pattern(alias)
        for alias in aliases
    ]
    for skill, aliases in SKILLS_TAXONOMY.items()
}


def extract_skills(text: str) -> set[str]:
    """Return the set of taxonomy skills whose aliases appear in `text`."""
    lowered = text.lower()
    found = set()
    for skill, patterns in _COMPILED_PATTERNS.items():
        for pattern in patterns:
            matched = (pattern in lowered) if isinstance(pattern, str) else bool(pattern.search(lowered))
            if matched:
                found.add(skill)
                break
    return found
