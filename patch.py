with open("web/src/workers/sanitizer.config.js", "r") as f:
    data = f.read()

data = data.replace("<<<<<<< HEAD\n", "")
data = data.replace("=======\n", "")
data = data.replace(">>>>>>> origin/main\n", "")

with open("web/src/workers/sanitizer.config.js", "w") as f:
    f.write(data)
