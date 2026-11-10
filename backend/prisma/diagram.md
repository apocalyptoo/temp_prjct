```graph TD
  User[User / Client App] -->|HTTP Requests| API[Express Server (API)]
  API -->|Routes| AdminController[Admin Controller]
  API -->|Routes| AuthController[Auth Controller]
  API -->|Routes| TeamController[Team Controller]
  API -->|Routes| PlayerController[Player Controller]
  API -->|Routes| OwnerController[Owner Controller]
  AdminController -->|DB Access| DB[(PostgreSQL/Prisma)]
  AuthController -->|DB Access| DB
  TeamController -->|DB Access| DB
  PlayerController -->|DB Access| DB
  OwnerController -->|DB Access| DB
  DB -->|Data| Controllers[All Controllers]
  ```