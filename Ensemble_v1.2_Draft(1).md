# Ensemble_v1.2_Draft.md

> AI'26 L19 Ensemble Learning Knowledge Base
>
> Status: Draft（課堂同步版）

------------------------------------------------------------------------

# 本次新增（2026/07/03）

## 老師課堂重點

### Ensemble Learning

老師說法（方便理解）：

> Ensemble Model = 把多個模型（或演算法）一起運作，得到更好的結果。

正式定義：

> Ensemble Learning 是將多個 Machine Learning
> 模型的預測結果加以整合，以提升整體預測能力的方法。

------------------------------------------------------------------------

# Ensemble 四大方法

  英文       正式名稱                 中文
  ---------- ------------------------ --------------------
  Bagging    Bootstrap Aggregating    自助聚合法
  Boosting   Boosting                 提升法
  Voting     Voting                   投票法
  Stacking   Stacked Generalization   堆疊泛化（堆疊法）

> 備註：老師若最後採三大分類，再依課程內容調整。

------------------------------------------------------------------------

# Bagging

Bagging = Bootstrap + Aggregating

## Bootstrap Sampling（自助抽樣）

-   有放回抽樣（Sampling with Replacement）
-   建立多個不同的訓練資料集
-   增加模型多樣性

## Aggregation（聚合）

把多個模型的結果整合。

Classification： - Majority Voting（多數決）

Regression： - Average（平均值）

## 流程

Original Dataset

↓

Bootstrap Sampling

↓

Model 1 Model 2 Model 3 ...

↓

Aggregation

↓

Final Prediction

------------------------------------------------------------------------

# Boosting

## 核心概念

前一個模型做錯，

下一個模型專門修正它。

## 特性

-   Sequential（序列式）
-   無法平行運算
-   通常比 Bagging 花更多時間
-   著重降低 Bias（偏差）

## 流程

Dataset

↓

Model 1

↓

Prediction Error

↓

Model 2

↓

Prediction Error

↓

Model 3

↓

Final Prediction

------------------------------------------------------------------------

# AdaBoost

## 一句話理解

上一個模型做錯的資料，

下一個模型會更加重視。

## 流程

Dataset

↓

Train Model 1

↓

Prediction

↓

Find Misclassified Samples

↓

Increase Sample Weights

↓

Train Model 2

↓

Prediction

↓

Increase Sample Weights

↓

Train Model 3

↓

Weighted Voting

↓

Final Prediction

## 注意

這裡的 Error 指的是：

**Prediction Error（預測錯誤）**

不是：

-   Python Error
-   Syntax Error
-   Debug 訊息

老師圈起來的那些資料點，就是錯誤分類樣本（Misclassified Samples）。

------------------------------------------------------------------------

# 待補充

-   Random Forest
-   OOB（Out-of-Bag）
-   Voting
-   Stacking
-   AutoML
-   PyCaret
-   TPOT
-   Optuna

------------------------------------------------------------------------

Version 1.2 Draft
