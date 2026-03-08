// Navigation functions
function goToLogin() {
    window.location.href = '/login';
}

function goToSignup() {
    window.location.href = '/signup';
}

function goToProfile() {
    window.location.href = '/profile-page';
}

function goToDashboard() {
    window.location.href = '/dashboard';
}

function goToSettings() {
    window.location.href = '/settings';
}

function goToMap() {
    window.location.href = '/map';
}

// Check authentication status
async function checkAuthentication() {
    try {
        const res = await fetch('/check-auth');
        const data = await res.json();
        
        const loginBtn = document.getElementById('login-btn');
        const signupBtn = document.getElementById('signup-btn');
        const logoutBtn = document.getElementById('logout-btn');
        const profileBtn = document.getElementById('profile-btn');
        const dashboardBtn = document.getElementById('dashboard-btn');
        const settingsBtn = document.getElementById('settings-btn');
        const mapBtn = document.getElementById('map-btn');
        const authRequired = document.getElementById('auth-required');
        const predictionForm = document.getElementById('prediction-form');
        
        if (data.authenticated) {
            // User is logged in
            if (loginBtn) loginBtn.style.display = 'none';
            if (signupBtn) signupBtn.style.display = 'none';
            if (logoutBtn) logoutBtn.style.display = 'block';
            if (profileBtn) profileBtn.style.display = 'block';
            if (dashboardBtn) dashboardBtn.style.display = 'block';
            if (settingsBtn) settingsBtn.style.display = 'block';
            if (mapBtn) mapBtn.style.display = 'block';
            if (authRequired) authRequired.style.display = 'none';
            if (predictionForm) predictionForm.style.display = 'block';
            
            // Set car info if available
            const carCompanySelect = document.getElementById('car-company');
            if (carCompanySelect && data.user.car_company) {
                carCompanySelect.value = data.user.car_company;
                loadCarModels();
                const carModelSelect = document.getElementById('car-model');
                if (carModelSelect && data.user.car_model) {
                    carModelSelect.value = data.user.car_model;
                }
            }
        } else {
            // User is not logged in
            if (loginBtn) loginBtn.style.display = 'block';
            if (signupBtn) signupBtn.style.display = 'block';
            if (logoutBtn) logoutBtn.style.display = 'none';
            if (profileBtn) profileBtn.style.display = 'none';
            if (dashboardBtn) dashboardBtn.style.display = 'none';
            if (settingsBtn) settingsBtn.style.display = 'none';
            if (mapBtn) mapBtn.style.display = 'none';
            if (authRequired) authRequired.style.display = 'block';
            if (predictionForm) predictionForm.style.display = 'none';
        }
    } catch (error) {
        console.error('Error checking authentication:', error);
    }
}

// Signup function
async function handleSignup() {
    const username = document.getElementById('signup-username').value;
    const email = document.getElementById('signup-email').value;
    const phone = document.getElementById('signup-phone').value;
    const location = document.getElementById('signup-location').value;
    const password = document.getElementById('signup-password').value;
    const carCompany = document.getElementById('signup-car-company').value;
    const carModel = document.getElementById('signup-car-model').value;
    const message = document.getElementById('signup-message');

    if (!username || !email || !password) {
        message.textContent = 'Please fill in all required fields';
        message.style.color = 'red';
        return;
    }

    if (!carCompany) {
        message.textContent = 'Please select a car company';
        message.style.color = 'red';
        return;
    }

    try {
        const res = await fetch('/signup', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                username,
                email,
                phone: phone || null,
                location: location || null,
                password,
                car_company: carCompany || null,
                car_model: carModel || null
            })
        });
        
        const data = await res.json();
        
        if (res.ok) {
            message.textContent = 'Account created successfully! Redirecting...';
            message.style.color = 'green';
            setTimeout(() => {
                window.location.href = '/dashboard';
            }, 2000);
        } else {
            message.textContent = data.error || 'Signup failed';
            message.style.color = 'red';
        }
    } catch (error) {
        message.textContent = 'Error: ' + error.message;
        message.style.color = 'red';
    }
}

// Login function
async function handleLogin() {
    const username = document.getElementById('login-username').value;
    const password = document.getElementById('login-password').value;
    const message = document.getElementById('login-message');
    
    if (!username || !password) {
        message.textContent = 'Please fill in all fields';
        message.style.color = 'red';
        return;
    }
    
    try {
        const res = await fetch('/login', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ username, password })
        });
        
        const data = await res.json();
        
        if (res.ok) {
            message.textContent = 'Login successful! Redirecting...';
            message.style.color = 'green';
            setTimeout(() => {
                window.location.href = '/dashboard';
            }, 2000);
        } else {
            message.textContent = data.error || 'Login failed';
            message.style.color = 'red';
        }
    } catch (error) {
        message.textContent = 'Error: ' + error.message;
        message.style.color = 'red';
    }
}

// Logout function
async function handleLogout() {
    try {
        const res = await fetch('/logout', {
            method: 'POST'
        });
        
        if (res.ok) {
            window.location.href = '/login';
        }
    } catch (error) {
        console.error('Error logging out:', error);
    }
}

// Load profile
async function loadProfile() {
    try {
        const res = await fetch('/profile');
        const data = await res.json();
        
        if (res.ok) {
            document.getElementById('profile-username').textContent = data.username;
            document.getElementById('profile-email').value = data.email;
            document.getElementById('profile-car-company').value = data.car_company || '';
            
            if (data.car_company) {
                await loadCarModels();
                document.getElementById('profile-car-model').value = data.car_model || '';
            }
        } else {
            window.location.href = '/login';
        }
    } catch (error) {
        console.error('Error loading profile:', error);
        window.location.href = '/login';
    }
}

// Update profile
async function updateProfile() {
    const email = document.getElementById('profile-email').value;
    const carCompany = document.getElementById('profile-car-company').value;
    const carModel = document.getElementById('profile-car-model').value;
    const message = document.getElementById('profile-message');
    
    try {
        const res = await fetch('/profile', {
            method: 'PUT',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                email,
                car_company: carCompany || null,
                car_model: carModel || null
            })
        });
        
        const data = await res.json();
        
        if (res.ok) {
            message.textContent = 'Profile updated successfully!';
            message.style.color = 'green';
        } else {
            message.textContent = data.error || 'Update failed';
            message.style.color = 'red';
        }
    } catch (error) {
        message.textContent = 'Error: ' + error.message;
        message.style.color = 'red';
    }
}

// Load car companies
async function loadCarCompanies() {
    try {
        const res = await fetch('/car-companies');
        const data = await res.json();
        
        const selectors = [
            document.getElementById('signup-car-company'),
            document.getElementById('car-company'),
            document.getElementById('profile-car-company'),
            document.getElementById('settings-car-company')
        ];
        
        selectors.forEach(selector => {
            if (selector) {
                // Keep the first option
                const firstOption = selector.options[0];
                selector.innerHTML = '';
                selector.appendChild(firstOption);
                
                // Add companies
                data.car_companies.forEach(company => {
                    const option = document.createElement('option');
                    option.value = company;
                    option.textContent = company.charAt(0).toUpperCase() + company.slice(1);
                    selector.appendChild(option);
                });
            }
        });
    } catch (error) {
        console.error('Error loading car companies:', error);
    }
}

// Load car models based on selected company
async function loadCarModels() {
    const company = document.getElementById('signup-car-company')?.value || 
                   document.getElementById('car-company')?.value || 
                   document.getElementById('profile-car-company')?.value ||
                   document.getElementById('settings-car-company')?.value;
    
    if (!company) return;
    
    try {
        const res = await fetch(`/car-models/${company}`);
        const data = await res.json();
        
        const selectors = [
            document.getElementById('signup-car-model'),
            document.getElementById('car-model'),
            document.getElementById('profile-car-model'),
            document.getElementById('settings-car-model')
        ];
        
        selectors.forEach(selector => {
            if (selector) {
                // Keep the first option
                const firstOption = selector.options[0];
                selector.innerHTML = '';
                selector.appendChild(firstOption);
                
                // Add models
                data.car_models.forEach(model => {
                    const option = document.createElement('option');
                    option.value = model;
                    option.textContent = model;
                    selector.appendChild(option);
                });
            }
        });
    } catch (error) {
        console.error('Error loading car models:', error);
    }
}

// Update index page user info (used by index.html)
async function updateIndexUserInfo() {
    try {
        const res = await fetch('/profile');
        const data = await res.json();

        if (res.ok) {
            const photoEl = document.getElementById('index-user-photo');
            const nameEl = document.getElementById('index-username');
            if (photoEl) photoEl.src = data.photo_url || '/static/images/default-profile.png';
            if (nameEl) nameEl.textContent = data.username || '';
        }
    } catch (err) {
        // ignore silently
    }
}

// Update result page user info (used by result.html)
async function updateResultUserInfo() {
    try {
        const res = await fetch('/profile');
        const data = await res.json();

        if (res.ok) {
            const photoEl = document.getElementById('result-user-photo');
            const nameEl = document.getElementById('result-username');
            if (photoEl) photoEl.src = data.photo_url || '/static/images/default-profile.png';
            if (nameEl) nameEl.textContent = data.username || '';
        }
    } catch (err) {
        // ignore silently
    }
}
