// Dashboard data loading
async function loadDashboardData() {
    try {
        const res = await fetch('/profile');
        const data = await res.json();
        
        if (res.ok) {
            // Top menu
            document.getElementById('dashboard-user-photo').src = data.photo_url || '/static/images/default-profile.png';
            document.getElementById('dashboard-username').textContent = data.username;

            // User card
            document.getElementById('dashboard-profile-photo').src = data.photo_url || '/static/images/default-profile.png';
            document.getElementById('dashboard-username-full').textContent = data.username;
            document.getElementById('dashboard-email').textContent = data.email;
            document.getElementById('dashboard-phone').textContent = data.phone || 'Not provided';
            document.getElementById('dashboard-location').textContent = data.location || 'Not provided';
            document.getElementById('dashboard-bio').textContent = data.bio || 'No bio added';

            // Vehicle card
            document.getElementById('dashboard-car-company').textContent = data.car_company || 'Not selected';
            document.getElementById('dashboard-car-model').textContent = data.car_model || 'Not selected';

            // Stats card
            const createdDate = data.created_at ? new Date(data.created_at) : new Date();
            const monthYear = createdDate.toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
            document.getElementById('member-since').textContent = monthYear;
        }
    } catch (error) {
        console.error('Error loading dashboard:', error);
    }
}

// Settings functions
async function loadSettingsData() {
    try {
        const res = await fetch('/profile');
        const data = await res.json();
        
        if (res.ok) {
            document.getElementById('settings-user-photo').src = data.photo_url || '/static/images/default-profile.png';
            document.getElementById('settings-username').textContent = data.username;
            document.getElementById('settings-username-input').value = data.username;
            document.getElementById('settings-email').value = data.email;
            document.getElementById('settings-phone').value = data.phone || '';
            document.getElementById('settings-location').value = data.location || '';
            document.getElementById('settings-bio').value = data.bio || '';
            document.getElementById('settings-profile-preview').src = data.photo_url || '/static/images/default-profile.png';
            
            document.getElementById('settings-car-company').value = data.car_company || '';
            if (data.car_company) {
                await loadCarModels();
                document.getElementById('settings-car-model').value = data.car_model || '';
            }
        }
    } catch (error) {
        console.error('Error loading settings:', error);
    }
}

function handlePhotoPreview(event) {
    const file = event.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            document.getElementById('settings-profile-preview').src = e.target.result;
        };
        reader.readAsDataURL(file);
    }
}

async function saveSettings() {
    const email = document.getElementById('settings-email').value;
    const phone = document.getElementById('settings-phone').value;
    const location = document.getElementById('settings-location').value;
    const bio = document.getElementById('settings-bio').value;
    const carCompany = document.getElementById('settings-car-company').value;
    const carModel = document.getElementById('settings-car-model').value;
    const currentPassword = document.getElementById('settings-current-password').value;
    const newPassword = document.getElementById('settings-new-password').value;
    const confirmPassword = document.getElementById('settings-confirm-password').value;
    const message = document.getElementById('settings-message');
    
    try {
        // Handle photo upload first
        const photoFile = document.getElementById('photo-upload').files[0];
        if (photoFile) {
            const formData = new FormData();
            formData.append('file', photoFile);
            
            const photoRes = await fetch('/upload-photo', {
                method: 'POST',
                body: formData
            });
            
            if (!photoRes.ok) {
                message.textContent = 'Photo upload failed';
                message.style.color = 'red';
                return;
            }
        }

        // Update profile
        const updateRes = await fetch('/profile', {
            method: 'PUT',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                email,
                phone,
                location,
                bio,
                car_company: carCompany || null,
                car_model: carModel || null
            })
        });

        if (!updateRes.ok) {
            message.textContent = 'Profile update failed';
            message.style.color = 'red';
            return;
        }

        // Handle password change if provided
        if (newPassword) {
            if (newPassword !== confirmPassword) {
                message.textContent = 'New passwords do not match';
                message.style.color = 'red';
                return;
            }

            if (!currentPassword) {
                message.textContent = 'Please enter your current password';
                message.style.color = 'red';
                return;
            }

            const pwdRes = await fetch('/change-password', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({
                    current_password: currentPassword,
                    new_password: newPassword,
                    confirm_password: confirmPassword
                })
            });

            if (!pwdRes.ok) {
                message.textContent = 'Password change failed';
                message.style.color = 'red';
                return;
            }
        }

        message.textContent = 'Settings saved successfully!';
        message.style.color = 'green';
        
        // Clear password fields
        document.getElementById('settings-current-password').value = '';
        document.getElementById('settings-new-password').value = '';
        document.getElementById('settings-confirm-password').value = '';
        
        setTimeout(() => {
            loadSettingsData();
        }, 1500);

    } catch (error) {
        message.textContent = 'Error: ' + error.message;
        message.style.color = 'red';
    }
}
