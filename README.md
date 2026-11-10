# Backend
cd d:\Project 1\backend
npm install
npx prisma generate
npx prisma migrate deploy
npm run dev

# App
cd d:\Project 1\IndoorFootballApp
npm install
npx react-native start
npx react-native run-android