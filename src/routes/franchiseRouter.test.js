const request = require('supertest');
const app = require('../service');
const { Role, DB } = require('../database/database.js');
const testUser = { name: 'pizza diner', email: 'reg@test.com', password: 'a' };
let registerRes;
let testUserAuthToken;

function randomName() {
    return Math.random().toString(36).substring(2, 12);
  }

async function createAdminUser() {
    let user = { password: 'toomanysecrets', roles: [{ role: Role.Admin }] };
    user.name = randomName();
    user.email = user.name + '@admin.com';
  
    user = await DB.addUser(user);
    return { ...user, password: 'toomanysecrets' };
}

beforeAll(async () => {
    testUser.email = Math.random().toString(36).substring(2, 12) + '@test.com';
    registerRes = await request(app).post('/api/auth').send(testUser);
    testUserAuthToken = registerRes.body.token;
    expectValidJwt(testUserAuthToken);
  });




test('listAllFranchises', async () =>{
    const listAllFranchisesRes = await request(app).get('/api/franchise');
    expect(listAllFranchisesRes.status).toBe(200);
});


test('listUserFranchises', async () =>{
    const listUserFranchisesRes = await request(app).get(`/api/franchise/${registerRes.body.user.id}`).set('Authorization', `Bearer ${testUserAuthToken}`);
    expect(listUserFranchisesRes.status).toBe(200);
});

test('createFranchise', async () =>{
    //login admin
    const admin = await createAdminUser();
    const loginAdmisRes = await request(app).put('/api/auth').send({email: admin.email, password: 'toomanysecrets'});
    expect(loginAdmisRes.status).toBe(200);
    const adminAuthToken = loginAdmisRes.body.token;

    //create franchise
    const createFranchiseRes = await request(app).post('/api/franchise').set('Authorization', `Bearer ${adminAuthToken}`).send({name: 'pizodket', admins: [{email: admin.email}]});
    expect(createFranchiseRes.status).toBe(200);

    //delete franchise
    const deleteAdminRes = await request(app).delete(`/api/franchise/${createFranchiseRes.body.id}`).set('Authorization', `Bearer ${adminAuthToken}`);
    expect(deleteAdminRes.status).toBe(200);
    expect(deleteAdminRes.body.message).toBe('franchise deleted')
})

test('createStore', async () =>{
    //login admin
    const admin = await createAdminUser();
    const loginAdmisRes = await request(app).put('/api/auth').send({email: admin.email, password: 'toomanysecrets'});
    expect(loginAdmisRes.status).toBe(200);
    const adminAuthToken = loginAdmisRes.body.token;

    //create franchise 
    const createFranchiseRes = await request(app).post('/api/franchise').set('Authorization', `Bearer ${adminAuthToken}`).send({name: 'pizodket', admins: [{email: admin.email}]});
    expect(createFranchiseRes.status).toBe(200);

    //create store
    const createStoreRes = await request(app).post(`/api/franchise/${createFranchiseRes.body.id}/store`).set('Authorization', `Bearer ${adminAuthToken}`).send({franchiseID: createFranchiseRes.body.id, name: "SLdC"})
    expect(createStoreRes.status).toBe(200);

    //delete franchise
    const deleteAdminRes = await request(app).delete(`/api/franchise/${createFranchiseRes.body.id}`).set('Authorization', `Bearer ${adminAuthToken}`);
    expect(deleteAdminRes.status).toBe(200);
    expect(deleteAdminRes.body.message).toBe('franchise deleted')

    //delete Store
    const deleteStoreRes = await request(app).delete(`/api/franchise/${createFranchiseRes.body.id}/store/${createStoreRes.body.id}`).set('Authorization', `Bearer ${adminAuthToken}`);
    expect(deleteStoreRes.status).toBe(200);
    expect(deleteStoreRes.body.message).toBe('store deleted')
})

function expectValidJwt(potentialJwt) {
    expect(potentialJwt).toMatch(/^[a-zA-Z0-9\-_]*\.[a-zA-Z0-9\-_]*\.[a-zA-Z0-9\-_]*$/);
  }
  