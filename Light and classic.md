# Web Design Preference: Light Parchment & Ink-Wash Theme (古典宣紙與深色水墨風格)

This document outlines the user's layout and style preferences for web application development in this workspace. All future AI agents modifying or creating web apps **MUST** follow these guidelines by default.

---

## 🎨 1. Core Color System (核心配色系統)

Always design with a **light, bright parchment/rice-paper** background and **dark charcoal/ink-black** typography. Avoid dark interfaces unless explicitly requested.

| Variable (CSS Token) | Light Parchment Value | Color Description (色彩說明) |
| :--- | :--- | :--- |
| `--bg-dark-gray` | `#f6f3ea` | Main background: Warm off-white rice-paper tone (暖淺灰宣紙底) |
| `--bg-deep-ink` | `#fcfbf9` | Component background: Crisp bright warm white (亮色底) |
| `--bg-card` | `rgba(253, 252, 247, 0.9)` | Card background: Semi-transparent paper white (半透明暖白) |
| `--text-primary` | `#2b2621` | Body typography: Deep tea charcoal-ink (深茶黑墨色) |
| `--text-secondary` | `#5c534c` | Muted typography: Soft charcoal grey-brown (灰褐墨色) |
| `--text-gold` | `#8b0000` | Accent text: Imperial red / Vermilion (深硃砂紅) |
| `--vermilion` | `#9e2a2b` | Call-to-action & badges: Rich vermilion red (硃砂紅) |
| `--gold-primary` | `#8c6b12` | Borders & highlights: Antique gold / Bronze (古金/青銅色) |
| `--gold-border` | `rgba(140, 107, 18, 0.22)`| Card borders: Semi-transparent bronze (古金色線條) |

---

## 🛠️ 2. CSS Snippets (CSS 程式碼範例)

Include these styling conventions in the main stylesheet (`styles.css`):

```css
/* 1. Base root variables */
:root {
    --bg-dark-gray: #f6f3ea;
    --bg-deep-ink: #fcfbf9;
    --bg-card: rgba(253, 252, 247, 0.9);
    --bg-glass: rgba(246, 243, 234, 0.8);
    --gold-primary: #8c6b12;
    --gold-dark: #6e530c;
    --gold-glow: rgba(140, 107, 18, 0.2);
    --vermilion: #9e2a2b;
    --vermilion-glow: rgba(158, 42, 43, 0.2);
    --text-primary: #2b2621;
    --text-secondary: #5c534c;
    --text-gold: #8b0000;
    --gold-border: rgba(140, 107, 18, 0.22);
    --card-shadow: 0 8px 24px 0 rgba(92, 80, 67, 0.12);
}

/* 2. Image Vignette effect on light backgrounds */
.beast-image-wrapper::after {
    content: '';
    position: absolute;
    bottom: 0;
    left: 0;
    width: 100%;
    height: 30%;
    /* Fade out image into the warm-white card color instead of deep dark colors */
    background: linear-gradient(to top, rgba(253, 252, 247, 0.95), transparent);
}

/* 3. Light Modal/Dialogs */
.modal-card {
    background: linear-gradient(135deg, #fdfcf7 0%, #f5f0e3 100%);
    border: 1px solid var(--gold-primary);
    box-shadow: 0 10px 40px 0 rgba(92, 80, 67, 0.25), 0 0 20px 0 rgba(140, 107, 18, 0.1);
}
```

---

## 🗂️ 3. Portfolio Card Integration (作品集展示卡片微調)

When adding a project link with custom water-ink backgrounds in `app.js` of the portfolio:
* **Background Gradient Overlay**: Set the gradient overlay of the card to be bright and semi-transparent.
* **CSS Class Rule**: Target the card's background url to dynamically change text and icons to darker tones.

**`app.js` Configuration:**
```javascript
{
    id: 'my-project-id',
    nameZh: '古典專案名稱',
    color: '#d4af37',
    bgStyle: {
        // High opacity white overlay makes the card background bright
        background: 'linear-gradient(rgba(253, 252, 247, 0.25), rgba(253, 252, 247, 0.8)), url("./assets/ink_wash_bg.png") center/cover no-repeat'
    }
}
```

**Portfolio `styles.css` Class Overrides:**
```css
/* Color icons and text dark dynamically for bright cards in the project gallery */
.card-img-placeholder[style*="ink_wash_bg"] {
    color: #9e2a2b !important; /* Vermilion icon */
}
.card-img-placeholder[style*="ink_wash_bg"] span {
    color: #2b2621 !important; /* Dark ink text */
    text-shadow: 0 1px 2px rgba(255, 255, 255, 0.8);
}
```

---

*Use these guidelines to create elegant, clean, readable, and highly aesthetic light-themed applications automatically.*
