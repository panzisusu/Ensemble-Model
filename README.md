# Ensemble Model Learning & Experiments

歡迎來到 **Ensemble Model（整合學習）** 練習與實驗資料夾。本資料夾專為機器學習中的整合學習方法（Ensemble Methods）所設立，包含課堂知識筆記與實作專案。

---

## 🎨 設計規範提醒 (Web Design Preferences)
本專案的網頁端展示（如 Streamlit App / HTML 介面）皆需遵循 [Light and classic.md](file:///d:/gogogo137%2020260703/Ensemble%20Model/Light%20and%20classic.md) 的**古典宣紙與深色水墨風格**：
- **主背景：** `#f6f3ea` (暖淺灰宣紙底) / 亮色卡片背景 `#fcfbf9`
- **文字：** `#2b2621` (深茶黑墨色) / 點綴字 `#8b0000` (硃砂紅)

---

## 📖 什麼是整合學習 (Ensemble Learning)？

> **老師說法：** 把多個模型（或演算法）一起運作，得到更好的結果。
> 
> **正式定義：** Ensemble Learning 是將多個 Machine Learning 模型的預測結果加以整合，以提升整體預測能力的方法。它能有效降低預測結果的**偏差 (Bias)**與**變異 (Variance)**。

---

## 📊 Ensemble 四大核心方法

| 英文名稱 | 正式名稱 | 中文翻譯 | 核心概念與流程簡圖 |
| :--- | :--- | :--- | :--- |
| **Bagging** | Bootstrap Aggregating | 自助聚合法 | 獨立並行訓練多個模型，最後透過投票或平均聚合結果。 |
| **Boosting** | Boosting | 提升法 | 序列式（Sequential）訓練模型，後續模型專門修正前一個模型的錯誤。 |
| **Voting** | Voting | 投票法 | 直接結合多個不同類型模型的預測結果，以多數決或加權平均決定。 |
| **Stacking** | Stacked Generalization | 堆疊法（堆疊泛化） | 使用多個基底模型預測，再訓練一個 meta-model（元模型）來整合預測。 |

---

## 1. Bagging (自助聚合法)

### 📌 核心機制
1. **Bootstrap Sampling (自助抽樣)：** 
   - 採用**有放回抽樣 (Sampling with Replacement)** 產生多個不同的子訓練集。
   - 藉此增加每個模型訓練資料的多樣性。
2. **Aggregation (聚合)：**
   - **分類問題 (Classification)：** 採用 **Majority Voting (多數決)**。
   - **回歸問題 (Regression)：** 採用 **Average (平均值)**。

```
                    [ 原始數據集 ]
                          │
         ┌────────────────┼────────────────┐ (Bootstrap Sampling 有放回抽樣)
         ▼                ▼                ▼
     [ 子樣本集 1 ]   [ 子樣本集 2 ]   [ 子樣本集 3 ]
         │                │                │
         ▼                ▼                ▼
     [ 模型 1 ]       [ 模型 2 ]       [ 模型 3 ]
         │                │                │
         └────────────────┼────────────────┘
                          ▼
                    [ 聚合 Aggregation ]
                    (多數決 Voting / 平均值 Average)
                          │
                          ▼
                    [ 最終預測結果 ]
```

---

## 2. Boosting (提升法)

### 📌 核心機制
- **序列式學習 (Sequential)：** 每個模型都是基於前一個模型的表現進行優化，無法平行運算。
- **目的：** 著重於降低模型的 **Bias (偏差)**。

```
  [ 原始數據集 ] ──> [ 模型 1 ] ──> 產生預測誤差 (Error)
                                         │
                                         ▼
                     [ 模型 2 ] ──> 專門修正模型 1 的誤差 ──> 產生新誤差
                                                                  │
                                                                  ▼
                                [ 模型 3 ] ──> 專門修正模型 2 的誤差 ──> [ 最終加權預測 ]
```

---

## 3. AdaBoost (自適應提升法)

### 📌 運作邏輯
- **“上一個模型做錯的資料，下一個模型會更加重視”**
- 每次迭代中，被**預測錯誤 (Prediction Error)** 的樣本其權重（Sample Weights）會被提高，使下一個模型能專注於這些困難的樣本。
- 最終透過 **Weighted Voting (加權投票)** 輸出預測結果。

```
[ 資料集 (等權重) ] ──> [ 訓練模型 1 ] ──> 計算預測錯誤樣本
                                               │
                                               ▼
[ 調整權重 (錯題權重↑) ] ──> [ 訓練模型 2 ] ──> 計算預測錯誤樣本
                                               │
                                               ▼
[ 調整權重 (錯題權重↑↑) ] ──> [ 訓練模型 3 ] ──> [ 加權投票 Weighted Voting ] ──> [ 最終預測 ]
```
> ⚠️ **注意：** 這裡的 Error 指的是 **Prediction Error（模型預測錯誤的資料點）**，而非語法錯誤（Syntax Error）或代碼錯誤（Bug）。

---

## 📝 待補充與後續實驗清單 (To-do List)

- [x] **Random Forest (隨機森林)：** 經典的 Bagging 應用，在沙盤中已實現節點特徵隨機抽樣。
- [ ] **OOB (Out-of-Bag)：** 自助抽樣時未被抽中（約佔 36.8%）的資料，可用於驗證模型效能。
- [x] **GBDT (梯度提升樹)：** 擬合機率殘差的回歸樹整合方法。
- [x] **Voting & Stacking 實作：** 結合軸向 Stump、Perceptron 線性與圓形劃分三種不同性質基底模型的多模型投票與堆疊。
- [ ] **AutoML 工具整合：**
  - **PyCaret**
  - **TPOT**
  - **Optuna** (超參數自動化調整)

---

## 📂 相關學習文件 (Documents)
- 📄 **ChatGPT 學習對話紀錄：** [Ensemble-chatGPT.pdf](./Ensemble-chatGPT.pdf)
- 📄 **本機對話與操作歷程：** [Ens-his.md](./Ens-his.md)

