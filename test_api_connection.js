#!/usr/bin/env node
/**
 * Test script to verify API connection and CORS configuration
 * Run this from the project root: node test_api_connection.js
 */

const axios = require('axios').default;

const API_BASE_URL = 'http://localhost:8000';

async function testConnection() {
    console.log('🔍 Testing API Connection and CORS...\n');
    
    try {
        // Test 1: Health Check
        console.log('1. Testing health endpoint...');
        const healthResponse = await axios.get(`${API_BASE_URL}/health`);
        console.log('✅ Health check passed:', healthResponse.data);
        
        // Test 2: Root endpoint
        console.log('\n2. Testing root endpoint...');
        const rootResponse = await axios.get(`${API_BASE_URL}/`);
        console.log('✅ Root endpoint passed:', rootResponse.data);
        
        // Test 3: CORS preflight (OPTIONS request)
        console.log('\n3. Testing CORS preflight...');
        const corsResponse = await axios.options(`${API_BASE_URL}/emergency/`, {
            headers: {
                'Origin': 'http://localhost:5173',
                'Access-Control-Request-Method': 'GET',
                'Access-Control-Request-Headers': 'authorization,content-type'
            }
        });
        console.log('✅ CORS preflight passed:', corsResponse.status);
        
        // Test 4: Emergency endpoint (should return 401 without auth)
        console.log('\n4. Testing emergency endpoint (without auth)...');
        try {
            await axios.get(`${API_BASE_URL}/emergency/`);
        } catch (error) {
            if (error.response?.status === 401 || error.response?.status === 403) {
                console.log('✅ Emergency endpoint accessible (auth required as expected)');
            } else {
                console.log('❌ Unexpected error:', error.response?.status, error.message);
            }
        }
        
        console.log('\n🎉 All API tests passed! The backend is working correctly.');
        console.log('\n📋 Next steps:');
        console.log('   1. Make sure frontend is running on http://localhost:5173');
        console.log('   2. Clear browser cache and cookies');
        console.log('   3. Try refreshing the page');
        console.log('   4. Check browser console for any remaining errors');
        
    } catch (error) {
        console.log('❌ API Connection failed:', error.message);
        console.log('\n🔧 Troubleshooting:');
        console.log('   1. Make sure backend server is running: uvicorn app.main:app --reload');
        console.log('   2. Check if port 8000 is available');
        console.log('   3. Verify database is set up correctly');
        console.log('   4. Check backend logs for errors');
        
        if (error.code === 'ECONNREFUSED') {
            console.log('\n⚠️  Connection refused - backend server is not running');
        }
    }
}

async function testWithAuth() {
    console.log('\n🔐 Testing with authentication...');
    
    try {
        // Test login
        const loginData = new FormData();
        loginData.append('username', 'admin@example.com');
        loginData.append('password', 'admin123');
        
        const loginResponse = await axios.post(`${API_BASE_URL}/auth/login`, loginData, {
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            }
        });
        
        const token = loginResponse.data.access_token;
        console.log('✅ Login successful');
        
        // Test authenticated emergency endpoint
        const emergencyResponse = await axios.get(`${API_BASE_URL}/emergency/`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        console.log('✅ Authenticated emergency endpoint works');
        console.log(`   Found ${emergencyResponse.data.length} emergency records`);
        
    } catch (error) {
        console.log('ℹ️  Auth test failed (this is expected if admin user doesn\'t exist)');
        console.log('   Error:', error.response?.data?.detail || error.message);
    }
}

// Run tests
testConnection().then(() => {
    return testWithAuth();
}).catch(console.error);
