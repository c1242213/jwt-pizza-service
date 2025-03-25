
const request = require('supertest');
const app = require('../service');
const { Role, DB } = require('../database/database.js');
const testUser = { name: 'pizza diner', email: 'reg@test.com', password: 'a' };
const testItem = {title: 'Student', description: 'No topping, no sauce, just carbs', image: 'pizza9.png', price: 0.0001}
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


test('get menu', async () =>{
    const getMenuRes = await request(app).get('/api/order/menu');
    expect(getMenuRes.status).toBe(200);

})

test('add item', async () =>{
    //login admin
    const admin = await createAdminUser();
    const loginAdmisRes = await request(app).put('/api/auth').send({email: admin.email, password: 'toomanysecrets'});        
    expect(loginAdmisRes.status).toBe(200);
    const adminAuthToken = loginAdmisRes.body.token;

    //add item
    const addItemRes = await request(app).put('/api/order/menu').set('Authorization', `Bearer ${adminAuthToken}`).send(testItem);
    expect(addItemRes.status).toBe(200);

})

test('get orders', async () =>{
    //login admin
    const admin = await createAdminUser();
    const loginAdmisRes = await request(app).put('/api/auth').send({email: admin.email, password: 'toomanysecrets'});        
    expect(loginAdmisRes.status).toBe(200);
    const adminAuthToken = loginAdmisRes.body.token;

    //get orders
    const getOrdersRes = await request(app).get('/api/order').set('Authorization', `Bearer ${adminAuthToken}`);
    expect(getOrdersRes.status).toBe(200);
 
})



  function expectValidJwt(potentialJwt) {
    expect(potentialJwt).toMatch(/^[a-zA-Z0-9\-_]*\.[a-zA-Z0-9\-_]*\.[a-zA-Z0-9\-_]*$/);
  }
  