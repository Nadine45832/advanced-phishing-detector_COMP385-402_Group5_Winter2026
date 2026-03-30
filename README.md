# advanced-phishing-detector
Advanced Email Phishing Detector


## To train Model
1. `cd backend/data`
2. `python3 create_model.py`

## To start server if you have running postgres (update database.py)

1. `cd backend/data`
2. `uvicorn app:app`


## to run it with docker:

1. install docker
2. in the root folder you can run `docker compose up --build`

if you change frontend, you dont need to rebuild docker.
if you change backend, you have to rebuild docker