import bcrypt from "bcryptjs";
import request from "supertest";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const databaseMock = vi.hoisted(() => ({ user: { findUnique: vi.fn() } }));
vi.mock("../../config/db", () => ({ default: databaseMock }));

import app from "../../app";
import { Role } from "../../constants/enums";

describe("authentication API", () => {
  let passwordHash: string;
  const user = {
    id: 2,
    name: "Sales User",
    email: "sales@example.test",
    role: Role.SALES,
    passwordHash: ""
  };

  beforeAll(async () => {
    process.env.JWT_SECRET = "test-secret-with-sufficient-length";
    passwordHash = await bcrypt.hash("correct-password", 4);
    user.passwordHash = passwordHash;
  });

  beforeEach(() => databaseMock.user.findUnique.mockReset());

  it("logs in with valid credentials", async () => {
    databaseMock.user.findUnique.mockResolvedValue(user);
    const response = await request(app)
      .post("/auth/login")
      .send({ email: user.email, password: "correct-password" });
    expect(response.status).toBe(200);
    expect(response.body.token).toEqual(expect.any(String));
    expect(response.body.user.role).toBe(Role.SALES);
  });

  it("rejects invalid credentials", async () => {
    databaseMock.user.findUnique.mockResolvedValue(null);
    const response = await request(app)
      .post("/auth/login")
      .send({ email: user.email, password: "wrong" });
    expect(response.status).toBe(401);
    expect(response.body.error.message).toBe("Invalid email or password");
  });

  it("rejects a protected request without a token", async () => {
    const response = await request(app).get("/challans");
    expect(response.status).toBe(401);
  });

  it("rejects a protected request with an invalid token", async () => {
    const response = await request(app)
      .get("/challans")
      .set("Authorization", "Bearer invalid-token");
    expect(response.status).toBe(401);
  });
});
