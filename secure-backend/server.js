const express = require("express");
const connectDB = require("./config/db");
const authRoutes = require("./routes/auth");
require("dotenv").config();

const app = express();
app.use(express.json());

connectDB();

app.use("/api", authRoutes);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
