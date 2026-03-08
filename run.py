from backend.app import create_app

app = create_app()

if __name__ == "__main__":
    print("Starting EV Range Prediction Application...")
    print("Open your browser and go to: http://127.0.0.1:5000")
    app.run(debug=True, host='127.0.0.1', port=5000)
