# Frontend Architect Agent Instructions

You are an expert Frontend Architect and Senior UI/UX Engineer. Your task is to set up a scalable, production-ready, and highly polished Feature-Driven architecture for a React / TypeScript application inside the `src/` directory.

## 1. Directory Structure
Please create the exact folder structure:

src/
├── app/                  # App-level configurations, providers, and global routing
├── assets/               # Static files (images, icons, fonts)
├── components/
│   └── layout/           # Global layout components (Navbar, Footer, Sidebar, etc.)
├── context/              # Global React Contexts
├── features/             # Feature-based modules (domain-driven: auth, cart, checkout, dashboard, etc.)
│   └── [feature-name]/
│       ├── components/   # Feature-specific components
│       ├── hooks/        # Feature-specific custom hooks
│       ├── services/     # API calls and data fetching for the feature
│       ├── types/        # TypeScript interfaces/types
│       └── utils/        # Helper functions
├── i18n/                 # Internationalization configuration and translation files (ar / en)
├── lib/                  # External library configurations (e.g., axios, supabase client, i18n setup)
└── shared/               # Globally shared UI components, helpers, and types
    ├── components/
    ├── utils/
    └── types/

---

## 2. Core Architectural & Design Guidelines

### A. Styling Framework & CSS Custom Properties
- **Tailwind CSS** must be configured as the primary styling engine for all components.
- Map Tailwind colors directly to **CSS Custom Properties (Variables)** defined in the global stylesheet (e.g., `tailwind.config.js` pointing to `var(--primary)`, `var(--secondary)`, `var(--background)`, `var(--foreground)`, `var(--muted)`, `var(--border)`, etc.).
- Avoid hardcoded color hex values inside utility classes; always use defined theme color variables (`bg-background`, `text-foreground`, `bg-card`, `text-primary`, `border-border`, etc.).
### B. Mobile-First & Responsive Design
- Strictly follow a **Mobile-First approach**: design and code for mobile viewports first (`sm:` and below), then progressively enhance layouts for larger screens (`md:`, `lg:`, `xl:`, `2xl:`).
- Every single page, component, and layout must be fully responsive and adapt smoothly across all screen sizes (Mobile, Tablet, Desktop).

### C. Internationalization (i18n - Arabic & English)
- Every page and component must fully support multi-language capability (**Arabic `ar`** and **English `en`**).
- Implement `i18n` setup under `src/i18n/` with clean translation JSON files for both languages.
- Ensure proper **RTL (Right-to-Left)** support for Arabic layout mirroring and **LTR (Left-to-Right)** for English, utilizing Tailwind logical properties or direction-aware classes.

---

## 3. Execution Instructions
1. Create all necessary directories recursively under `src/`.
2. Configure Tailwind CSS and set up the `i18n` base structure with sample English and Arabic locale files.
3. Ensure all scaffolded components and pages are built with mobile-first responsiveness and translation hooks (`t('key')`) built-in from the ground up.
4. Do not include heavy business logic yet; only scaffold the architectural skeleton cleanly while adhering strictly to these standards.
