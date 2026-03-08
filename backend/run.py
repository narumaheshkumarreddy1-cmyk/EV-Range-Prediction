from app import create_app

app = create_app()

if __name__ == "__main__":
    print("Starting EV Range Prediction Application...")
    print("Open your browser and go to: http://127.0.0.1:5000")
    print("To access from another device on your network, use: http://YOUR_IP_ADDRESS:5000")
    app.run(debug=True, host='0.0.0.0', port=5000)
