## BudgetManager

### Overview

Manage your incomes, expenses, transfers and bank account balances in one platform.  
Features:

- Store all incomes and expenses in one database.
- Automate transactions activity using templates.
- Export a snapshot of your data into excel.
- Organize incomes and expenses in different categories.
- Maintain all bank account balances with different currencies.
- Visualize transactions over time using visual graphs.
- Convert between different currencies.
- Register and login to your personal account.

### Architecture

![image](https://github.com/GabrielKuka/budgetmanager/assets/17888328/e287468b-6536-463d-adb5-a57d90e2a9a0)  
Both the frontend and backend run on separate docker containers that communicate with each other using network requests. Requests are sent using [Axios](https://axios-http.com/). This setup is managed using **docker compose**. Because this is a small local project, the platform uses **SQLite** to store user data.
