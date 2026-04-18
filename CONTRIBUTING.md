# Contributing to PDF Toolbox

Thank you for your interest in contributing! PDF Toolbox is a free, open-source, 100% client-side PDF tool. All processing happens locally in the browser — no files are ever uploaded to a server.

## How to Contribute

### Fork & Pull Request

1. **Fork** the repository on GitHub
2. **Clone** your fork locally:
   ```bash
   git clone https://github.com/YOUR_USERNAME/pdf-toolbox.git
   cd pdf-toolbox
   ```
3. **Create a branch** for your changes:
   ```bash
   git checkout -b feature/your-feature-name
   ```
4. **Make your changes** and commit with clear messages
5. **Push** to your fork:
   ```bash
   git push origin feature/your-feature-name
   ```
6. **Open a Pull Request** against the `master` branch of the main repository

### Development Setup

```bash
# Install dependencies
npm install

# Start the development server (with hot reload)
npm run dev

# Build for production
npm run build

# Preview the production build locally
npm run preview
```

The dev server will start at `http://localhost:5173` (or another port if 5173 is in use).

### Code Guidelines

- **Language**: JavaScript (ES Modules)
- **Style**: Follow existing code style (2-space indentation, semicolons, JSDoc comments for exported functions)
- **No external APIs**: All processing must be 100% client-side. No server calls, no tracking beyond analytics.
- **Security**: Never commit API keys, tokens, or personal data
- **Commits**: Use descriptive commit messages (e.g., `fix: handle edge case in PDF merge`, `feat: add image-to-PDF conversion`)
- **Testing**: Test your changes manually in multiple browsers before submitting

### What You Can Work On

- Bug fixes
- New PDF features (rotate, reorder, extract pages, etc.)
- UI/UX improvements
- Performance optimizations
- Documentation
- Accessibility improvements

### Reporting Issues

Before opening an issue, please search existing issues to avoid duplicates. Include:
- Browser and version
- Steps to reproduce
- Expected vs. actual behavior
- Screenshots if applicable

---

By contributing, you agree that your contributions will be licensed under the MIT License.
