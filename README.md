# Tools Upgrade Main Project

## Project Overview
This project Tools Upgrade is a web application built using React and TypeScript. It facilitates upgrading third-party tools with a user-friendly interface. The application includes components for tool selection, upgrade progress monitoring, and upgrade wizards, along with backend service interaction for managing upgrades.

## Features
- Select from a list of supported third-party tools to upgrade.
- View detailed information about each tool.
- Guided upgrade wizard to help through the upgrade process.
- Real-time upgrade progress monitoring.
- Modal dialogs for additional information and upgrade actions.
- Responsive and polished UI built with React and Tailwind CSS.

## Folder Structure
```
D:\work_dsi\Apps\tools-upgrade-main
│
├── eslint.config.js                 # ESLint configuration
├── index.html                      # Main HTML file for the React app
├── package-lock.json               # Package lock for npm dependencies
├── package.json                   # npm manifest file describing dependencies and scripts
├── postcss.config.js              # PostCSS configuration (CSS processing)
├── README.md                      # Project documentation (This file)
├── run-as-admin.bat               # Script to run app with admin privileges (Windows)
├── server.mjs                     # Backend server script (if used)
├── tailwind.config.js             # TailwindCSS configuration
├── tsconfig.app.json              # TypeScript configuration for app source
├── tsconfig.json                 # General TypeScript configuration
├── tsconfig.node.json             # TypeScript configuration for Node.js
├── upgrade.mjs                   # Possibly upgrade related script
├── vite.config.ts                # Vite bundler configuration for the project
│
├── .idea                         # IntelliJ IDE project config files
│
└── src                           # Source code folder
    │
    ├── App.tsx                   # Main React component entry point
    ├── index.css                 # Global CSS styles
    ├── main.tsx                  # React app bootstrapping file
    ├── vite-env.d.ts             # Vite environment typings
    │
    ├── components                # React UI components
    │   ├── Dashboard.tsx        # Main dashboard UI
    │   ├── ToolCard.tsx         # Tool display card component
    │   ├── ToolDetailsModal.tsx # Modal showing details of tools
    │   ├── ToolSelector.tsx     # Tool selection UI
    │   ├── UpgradeModal.tsx     # Modal for upgrades
    │   ├── UpgradeProgress.tsx  # UI showing progress of ongoing upgrade
    │   ├── UpgradeWizard.tsx    # Wizard UI guiding upgrade steps
    │
    ├── data                     # Static data and tool related info
    │   ├── supportedTools.ts    # Supported tools list and details
    │   ├── tools.ts             # Tool related helper data/functions
    │
    ├── services                 # Business logic and API service layer
    │   ├── upgradeService.ts    # Service for interacting with upgrade backend/API
    │
    └── types                   # TypeScript type definitions
        ├── index.ts            # Global/shared types
```

## Installation and Setup

1. **Prerequisites**
   - Node.js (version 16 or higher recommended)
   - npm (comes with Node.js) or yarn
   - Git (optional, for cloning repository)

2. **Install dependencies**
   Open a terminal in the project root directory and run:

   ```
   npm install
   ```

   or if using yarn:

   ```
   yarn install
   ```

3. **Run the project**

   - To start the development server:

   ```
   npm run dev
   ```

   or for yarn:

   ```
   yarn dev
   ```

   This will launch the application locally (usually on http://localhost:3000 or a port configured in `vite.config.ts`).

4. **Build for Production**

   To create a production build:

   ```
   npm run build
   ```

   or

   ```
   yarn build
   ```

   The build output will be in the `dist/` folder, ready to be deployed to a web server.

5. **Useful Scripts**

   - `run-as-admin.bat`: This Windows batch script can be used to start processes (likely the dev server) with administrative privileges if needed.
   - Other npm scripts are available in `package.json` under the `scripts` section.

## Usage and UI Overview

- **Dashboard:** Main view showing all upgradeable tools.
- **Tool Selector:** Allows filtering and picking tools to upgrade.
- **Tool Details Modal:** Displays detailed information for selected tools.
- **Upgrade Wizard:** Step-by-step interface guiding the upgrade process.
- **Upgrade Progress:** Real-time visual feedback on upgrade status.
- **Upgrade Modal:** Confirmation and action modal for upgrades.


## Troubleshooting and Known Issues

- Ensure Node.js and npm/yarn versions meet the prerequisites.
- If encountering permission errors on Windows, try running with `run-as-admin.bat`.
- If the dev server doesn't start, verify no other processes occupy the configured port.
- Clear npm cache or reinstall node_modules if dependency issues occur.

## Contributing

Contributions are welcome! Please follow these guidelines:

1. Fork the repository.
2. Create a feature branch.
3. Commit changes with descriptive messages.
4. Submit a pull request summarizing your changes.

Please adhere to existing code style and test thoroughly before submitting.

## Support and Contact

For support or questions, please contact the project maintainer or open issues on the project repository.

---

For any detailed help or running into issues, feel free to ask!
