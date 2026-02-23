# Railway: build and run the live signals Python app
FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Unbuffered stdout so Railway shows every print immediately
ENV PYTHONUNBUFFERED=1
CMD ["python", "run_rth_loop.py"]
