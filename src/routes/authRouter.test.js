const request = require('supertest');
const app = require('../service');

const testUser = { name: 'pizza diner', email: 'reg@test.com', password: 'a' };
let testUserAuthToken;
let registerRes;

beforeAll(async () => {
  testUser.email = Math.random().toString(36).substring(2, 12) + '@test.com';
  registerRes = await request(app).post('/api/auth').send(testUser);
  testUserAuthToken = registerRes.body.token;
  expectValidJwt(testUserAuthToken);
});

test('login', async () => {
  const loginRes = await request(app).put('/api/auth').send(testUser);
  expect(loginRes.status).toBe(200);
  expectValidJwt(loginRes.body.token);

  const expectedUser = { ...testUser, roles: [{ role: 'diner' }] };
  delete expectedUser.password;
  expect(loginRes.body.user).toMatchObject(expectedUser);
});

test('register', async () => {
  const registerUser = { name: 'carl', email: 'carl@test.com', password: 'carl' };
  const registerRes = await request(app).post('/api/auth').send(registerUser);
  expect(registerRes.status).toBe(200);
  expectValidJwt(registerRes.body.token);

})

test('update', async () =>{
  const updateUser = {email: 'testing@jwtSecret.com', password: "carl"}
  const updateRes = await request(app).put(`/api/auth/${registerRes.body.user.id}`).set('Authorization', `Bearer ${testUserAuthToken}`).send(updateUser)
  expect(updateRes.status).toBe(200);
  expect(updateRes.body.email).toBe('testing@jwtSecret.com');
})

test('delete', async () =>{
  const deleteRes = await request(app).delete(`/api/auth`).set('Authorization', `Bearer ${testUserAuthToken}`)
  expect(deleteRes.status).toBe(200);
  expect(deleteRes.body.message).toBe('logout successful')
})



function expectValidJwt(potentialJwt) {
  expect(potentialJwt).toMatch(/^[a-zA-Z0-9\-_]*\.[a-zA-Z0-9\-_]*\.[a-zA-Z0-9\-_]*$/);
}
