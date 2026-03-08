from flask import Flask
from flask_cors import CORS
from flask_login import LoginManager
import os
from .models import db
from flask_migrate import Migrate

migrate = Migrate()
login_manager = LoginManager()

def create_app():
    # Get the absolute path to the frontend folder
    frontend_path = os.path.abspath(os.path.join(os.path.dirname(__file__), '../../frontend'))

    app = Flask(__name__,
                static_folder=os.path.join(frontend_path, 'static'),
                static_url_path='/static',
                template_folder=os.path.join(frontend_path, 'templates'))

    # Configure database
    app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///ev_app.db'
    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
    app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'your_secret_key_change_in_production')

    # Initialize database
    db.init_app(app)

    # Initialize migrations
    migrate.init_app(app, db)

    CORS(app)

    @login_manager.user_loader
    def load_user(user_id):
        from .models.user import User
        return User.query.get(int(user_id))

    # Register blueprints
    from .routes.ev_routes import ev
    from .routes.auth_routes import auth

    app.register_blueprint(ev)
    app.register_blueprint(auth)

    # Root route - redirect to landing or dashboard
    @app.route('/')
    def index():
        from flask import session, redirect, url_for
        if 'user_id' in session:
            return redirect(url_for('ev.dashboard_page'))
        return redirect(url_for('ev.login_page'))

    # Create database tables
    with app.app_context():
        db.create_all()

    return app


# Create the application instance
app = create_app()

if __name__ == "__main__":
    print("Starting EV Range Prediction Application...")
    print("Open your browser and go to: http://127.0.0.1:5000")
    app.run(debug=True, host='0.0.0.0', port=5000)
