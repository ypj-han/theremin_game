import json
import csv

# 假设你有一个 JSON 文件叫 "music_data.json"
with open("./orb.json", "r") as f:
    data = json.load(f)

# 提取 notes
notes = data["tracks"][0]["notes"]

# 提取 midi 和 time
midi_values = [note["midi"] for note in notes]
time_values = [note["time"] for note in notes]

# 写入 CSV 文件
with open("midi_time_output.csv", mode="w", newline='') as file:
    writer = csv.writer(file)
    writer.writerow(["midi", "time"])  # CSV 表头
    for midi, time in zip(midi_values, time_values):
        writer.writerow([midi, time])

print("CSV 文件已保存为 midi_time_output.csv")
