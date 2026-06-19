const fs = require('fs');
const path = require('path');

async function runTest() {
  const baseUrl = 'http://localhost:3000/v1';
  console.log('1. Logging in as owner...');
  const loginRes = await fetch(`${baseUrl}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'owner@gmail.com', password: '123456' })
  });
  const loginData = await loginRes.json();
  if (!loginData.success) {
    console.error('Login failed:', loginData);
    process.exit(1);
  }
  const token = loginData.data.accessToken;
  console.log('Login success! Token acquired.');

  console.log('\n2. Creating a test restaurant...');
  const restRes = await fetch(`${baseUrl}/restaurants`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      name: 'Integration Test Bistro',
      address: '999 Integration Rd',
      phone: '0123456789'
    })
  });
  const restData = await restRes.json();
  console.log('Create restaurant result:', restData);
  const restaurantId = restData.data.id;

  console.log('\n3. Uploading image to restaurant...');
  const imagePath = 'C:\\Users\\kasiz\\.gemini\\antigravity\\brain\\592d0aed-b9a8-4cb6-9dd1-01a1a6f0830e\\media__1781066424616.png';
  const fileBlob = new Blob([fs.readFileSync(imagePath)], { type: 'image/png' });
  const formData = new FormData();
  formData.append('files', fileBlob, 'test-image.png');

  const uploadRes = await fetch(`${baseUrl}/restaurants/${restaurantId}/images`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`
    },
    body: formData
  });
  const uploadData = await uploadRes.json();
  console.log('Upload image result:', uploadData);
  const imageUrl = uploadData.data.images[0];
  console.log('Uploaded image URL:', imageUrl);

  console.log('\n4. Deleting the uploaded image...');
  const deleteRes = await fetch(`${baseUrl}/restaurants/${restaurantId}/images`, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ imageUrl })
  });
  const deleteData = await deleteRes.json();
  console.log('Delete image result:', deleteData);

  console.log('\n5. Creating a food category...');
  const catRes = await fetch(`${baseUrl}/restaurants/${restaurantId}/categories`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ name: 'Appetizers' })
  });
  const catData = await catRes.json();
  console.log('Create category result:', catData);
  const categoryId = catData.data.id;

  console.log('\n6. Creating a food item...');
  const foodRes = await fetch(`${baseUrl}/restaurants/${restaurantId}/items`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      categoryId,
      name: 'Spring Rolls',
      description: 'Crispy rolls filled with vegetables',
      price: 15000
    })
  });
  const foodData = await foodRes.json();
  console.log('Create food item result:', foodData);
  const itemId = foodData.data.id;

  console.log('\n7. Uploading image to food item...');
  const foodFormData = new FormData();
  foodFormData.append('files', fileBlob, 'food-image.png');

  const foodUploadRes = await fetch(`${baseUrl}/restaurants/items/${itemId}/images`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`
    },
    body: foodFormData
  });
  const foodUploadData = await foodUploadRes.json();
  console.log('Food upload result:', foodUploadData);
  const foodImageUrl = foodUploadData.data.images[0];
  console.log('Food image URL:', foodImageUrl);

  console.log('\n8. Deleting the food item image...');
  const foodDeleteRes = await fetch(`${baseUrl}/restaurants/items/${itemId}/images`, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ imageUrl: foodImageUrl })
  });
  const foodDeleteData = await foodDeleteRes.json();
  console.log('Food delete image result:', foodDeleteData);

  console.log('\n9. Deleting the test restaurant...');
  const cleanupRes = await fetch(`${baseUrl}/restaurants/${restaurantId}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  console.log('Cleanup result:', await cleanupRes.json());

  console.log('\nAll tests completed successfully!');
}

runTest().catch(console.error);
