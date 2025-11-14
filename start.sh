source .env

# check if tmux is installed
if ! command -v tmux &> /dev/null; then
    echo "tmux could not be found, please install it via: brew install tmux"
    exit 1
fi

# check if ngrok is installed
if ! command -v ngrok &> /dev/null; then
    echo "ngrok could not be found, please install it via https://ngrok.com/download"
    exit 1
fi

# check NGROK_URL is set
if [ -z "$NGROK_URL" ]; then
    echo "NGROK_URL is not set, please set it in the .env file"
    exit 1
fi

# Kill existing session if it exists
tmux kill-session -t basic-proxy 2>/dev/null

# Create new tmux session with two panes
tmux new-session -d -s basic-proxy -x 200 -y 50

# Split window horizontally
tmux split-window -h -t basic-proxy

# Run node app in left pane (pane 0)
#tmux send-keys -t basic-proxy:0.0 "source .env && node app.js" C-m
tmux send-keys -t basic-proxy:0.0 "source .env && npm run dev" C-m

# Run ngrok in right pane (pane 1)
tmux send-keys -t basic-proxy:0.1 "source .env && ngrok http \$PORT --url=\$NGROK_URL --host-header=rewrite" C-m

# Attach to the session
tmux attach-session -t basic-proxy
