FROM python:3.8

WORKDIR /app/backend

COPY . .

RUN pip install --upgrade pip setuptools && pip install -r requirements.txt

EXPOSE 8001

CMD ["python", "manage.py", "runserver", "0.0.0.0:8001"]