const express = require('express');
const mongoose = require('mongoose');
const authRoutes = require('./routes/authRoutes');
const User = require('./models/User');
const cookieParser = require('cookie-parser');
const { requireAuth } = require('./middleware/authMiddleware');
const { OpenAI } = require('openai');
const _ = require('lodash');
require('dotenv').config();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_KEY,
});
const app = express();

const cartSchema = new mongoose.Schema({
  id: {
    type: String,
    required: true,
  },
  name: {
    type: String,
  },
  quantity: {
    type: Number,
    required: true,
    default: 1,
  },
  totalPrice: {
    type: Number,
    required: true,
  },
});
const Cart = mongoose.model('Cart', cartSchema);
// Define a schema for the Product model
const productSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  category: {
    type: String,
    required: true,
  },
  price: {
    type: Number,
    required: true,
  },
  image: {
    type: String, // You can store the image URL here
    required: true,
  },
  description: {
    type: String, // You can add a description field if needed
  },
  stock: {
    type: Number,
    required:true,
  }
  // You can add more fields as needed for your products
});
//Orders placed
//comment to test
const orderSchema = new mongoose.Schema({
  // User ID, referencing the User model
  id: {
    type: String,
    required: true,
  },
  // Array of ordered product names
  itemsOrdered: {
    type: [
      {
        name: String,
        quantity: Number,
      },
    ],
    required: true,
  },
  // Total price of the order
  totalPrice: {
    type: Number,
    required: true,
  },
  // Shipping address
  address: {
    type:String,
    required:true,
    default:"Room 101 Default Building,Mumbai",
  },
  // Payment method used
  paymentMethod: {
    type: String,
    default:"Cash on Delivery",
    required: true,
  },
  // Date and time when the order was placed
  date: {
    type: Date,
    default: Date.now,
  },
  // Order status (e.g., processing, shipped, delivered)
  status: {
    type: String,
    enum: ['Processing', 'Shipped', 'Delivered'],
    default: 'Processing',
  },
});
const Order = mongoose.model('Order', orderSchema);



// Create a model for the Product schema
const Product = mongoose.model('Product', productSchema);

// middleware
app.use(express.static('public'));
app.use(express.json());
app.use(cookieParser());

// view engine
app.set('view engine', 'ejs');

// database connection
const dbURI = 'mongodb+srv://tsemwal:tsemwal@cluster0.yzsyf3y.mongodb.net/test';
mongoose.connect(dbURI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then((result) => app.listen(3001))
  .catch((err) => console.log(err));

// routes
app.get('/', (req, res) => res.render('home'));

app.get('/smoothies', requireAuth, async (req, res) => {
  const user = req.user;
  const cartItems = await Cart.find({ id : user });
  res.render('smoothies', { user:user,cartItems });
});

// Display the cart items
// In your server route that renders the page
app.get('/mycart', requireAuth, async (req, res) => {
  try {
    // Fetch and display the cart items for the currently authenticated user
    const cartItems = await Cart.find({ id: req.user });

    // Create a map of item names to indicate if each item is in the cart
    const itemInCartMap = {};
    cartItems.forEach(item => {
      itemInCartMap[item.name] = true;
    });

    res.render('cart', { cartItems, itemInCartMap, itemIndex: 0 }); // Pass itemIndex as 0
  } catch (error) {
    console.error('Error fetching cart items:', error);
    res.status(500).send('Internal server error');
  }
});


app.post('/add-to-cart', requireAuth, async (req, res) => {
  const { userId, item, quantity, totalPrice } = req.body;

  try {
    // Check if the item is already in the user's cart
    const existingCartItem = await Cart.findOne({ id: req.user, name: item });

    if (existingCartItem) {
      // If the item is already in the cart, update the quantity and total price
      existingCartItem.quantity += quantity;
      existingCartItem.totalPrice += totalPrice;
      await existingCartItem.save();
    } else {
      // If the item is not in the cart, create a new cart item
      const cartItem = new Cart({
        id: req.user,
        name: item,
        quantity,
        totalPrice,
      });
      await cartItem.save();
    }

    res.status(200).json({ message: 'Item added to cart successfully' });
  } catch (error) {
    console.error('Error adding item to cart:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.delete('/remove-from-cart/:userId/:itemId', requireAuth, async (req, res) => {
  const userId = req.params.userId;
  const itemId = req.params.itemId;
  try {
    // Find and remove the item from the cart
    const result = await Cart.deleteOne({ id: req.user, _id: itemId });

    if (result.deletedCount === 1) {
      res.status(200).json({ message: 'Item removed from cart successfully' });
    } else {
      res.status(404).json({ error: 'Item not found in cart' });
    }

  } catch (error) {
    console.error('Error removing item from cart:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});
app.get('/products', requireAuth, async (req, res) => {
  try {
    // Render an HTML view for products
    res.render('products');
  } catch (error) {
    console.error('Error rendering products view:', error);
    res.status(500).send('Internal server error');
  }
});
app.get('/api/products', requireAuth, async (req, res) => {
  try {
    const category = req.query.category; // Get the category from the query parameter
    const minPrice = parseFloat(req.query.minPrice); // Get the min price from the query parameter
    const maxPrice = parseFloat(req.query.maxPrice); // Get the max price from the query parameter
    console.log(category);


    // Build a query to fetch products based on category and price range
    const query = {};
    if (category) {
        query.category = category;
    }
    if (!isNaN(minPrice) && !isNaN(maxPrice)) {
        query.price = { $gte: minPrice, $lte: maxPrice };
        console.log(query);
    }

    // Fetch products from the database and send as JSON
    const products = await Product.find(query);
    console.log(products)

    res.json(products);
    } catch (error) {
        console.error('Error fetching products:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
app.get('/api/nameProducts', requireAuth, async (req, res) => {
  try {
    const name = req.query.name; // Get the category from the query parameter
    
    const lowercaseName = name ? name.toLowerCase() : '';
    // Build a query to fetch products based on the category
    // const query = name ? { name } : {}; // If category is provided, filter by category; otherwise, fetch all products
    const query = name ? { name: { $regex: new RegExp(lowercaseName, 'i') } } : {};
    // Fetch products from the database and send as JSON
    const products = await Product.find(query); // Replace 'Product' with your model name
    
    
    res.json(products);
  } catch (error) {
    console.error('Error fetching products:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});
// Add a new route to fetch hotdeals data from MongoDB
app.get('/api/hotdeals', requireAuth, async (req, res) => {
  try {
    // Fetch hotdeals data from MongoDB
    const hotdealsData = await Product.find({ category: 'hotdeals' });

    // Send the hotdeals data as JSON response
    res.json(hotdealsData);
  } catch (error) {
    console.error('Error fetching hotdeals data:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/checkout', requireAuth, async (req, res) => {
  try {
    const userId = req.user;
    const address = req.body.address;
    if (!req.body.address || req.body.address.trim() === '') {
      return res.status(400).json({ success: false, error: 'Address is required for checkout' });
    }
    // Fetch the user's cart items
    const cartItems = await Cart.find({ id: userId });

    // Check if there is enough stock for all items in the cart
    for (const cartItem of cartItems) {
      const product = await Product.findOne({ name: cartItem.name });

      if (!product || product.stock < cartItem.quantity) {
        // If the product is not found or there's not enough stock, return an error
        return res.status(400).json({ success: false, error: 'Not enough stock for an item in the cart' });
      }
    }

    // Calculate the subtotal
    let subtotal = 0;
    cartItems.forEach(item => {
      subtotal += parseFloat(item.totalPrice);
    });

    // Calculate GST (5%) and delivery charges
    const gst = 0.05 * subtotal;
    const deliveryCharges = 1;

    // Calculate the final total price including GST and delivery charges
    const totalPrice = subtotal + gst + deliveryCharges;

    // Check the payment method selected by the user
    const paymentMethod = req.body.paymentMethod;

    if (paymentMethod === 'MyWallet') {
      // Retrieve the user's current wallet balance from the database
      const user = await User.findById(userId);

      if (!user) {
        return res.status(404).json({ success: false, error: 'User not found' });
      }

      // Check if the user has sufficient balance for the purchase
      if (user.wallet < totalPrice) {
        return res.status(400).json({ success: false, error: 'Insufficient balance for checkout' });
      }

      // Deduct the total price from the user's wallet
      user.wallet -= totalPrice;
      user.purchaseValue+= totalPrice;

      // Save the updated wallet balance back to the database
      await user.save();
    }

    // Create an array to store the items ordered for the Order schema
    const itemsOrdered = cartItems.map(cartItem => ({
      name: cartItem.name,
      quantity: cartItem.quantity,
    }));

    // Create a new Order document and save it to the database
    const order = new Order({
      id: userId,
      itemsOrdered,
      totalPrice,
      address: req.body.address,
      paymentMethod,
    });

    await order.save();

    // Deduct stock for the items in the cart
    for (const cartItem of cartItems) {
      const product = await Product.findOne({ name: cartItem.name });
      if (product) {
        product.stock -= cartItem.quantity;
        await product.save();
      }
    }

    // Clear the user's cart
    await Cart.deleteMany({ id: userId });

    res.status(200).json({ success: true, message: 'Checkout successful' });
  } catch (error) {
    console.error('Error during checkout:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});


//For myorders page
app.get('/myorders', requireAuth, async (req, res) => {
  try {
    // Fetch the user's orders from the Order model based on their user ID
    const userId = req.user;
    const userOrders = await Order.find({ id: userId }).sort({ date: -1 }); // Sort orders by date in descending order

    // Render the "My Orders" page and pass the orders data to the template
    res.render('myorders', { orders: userOrders });
  } catch (error) {
    console.error('Error fetching user orders:', error);
    res.status(500).send('Internal server error');
  }
});
// ...
app.delete('/cancel-order/:orderId', requireAuth, async (req, res) => {
  try {
    const orderId = req.params.orderId;
    const userId = req.user;

    // Retrieve the canceled order
    const order = await Order.findOne({ _id: orderId, id: userId });

    if (!order) {
      return res.status(404).json({ success: false, error: 'Order not found' });
    }

    // If the payment method is "Cash on Delivery" (COD), do not refund the wallet
    
      // Iterate through the items in the canceled order
    for (const itemOrdered of order.itemsOrdered) {
      const productName = itemOrdered.name;
      const productQuantity = itemOrdered.quantity;

      // Find the product and update its stock
      const product = await Product.findOne({ name: productName });

      if (!product) {
        console.error('Product not found:', productName);
        continue;
      }

      // Log the product and its stock before the update
      console.log('Product Before Update:', product);

      // Refund the stock for the canceled items
      product.stock += productQuantity;
      

      await product.save();

      // Log the product and its stock after the update
      console.log('Product After Update:', product);
    }
    

    // If the payment method is "MyWallet," refund the order amount to the user's wallet
    if (order.paymentMethod === 'MyWallet') {
      const refundedAmount = order.totalPrice;
      const user = await User.findById(userId);

      if (!user) {
        return res.status(404).json({ success: false, error: 'User not found' });
      }

      // Log the user's wallet balance before the refund
      console.log('User Wallet Before Refund:', user.wallet);

      // Refund the amount to the user's wallet
      user.wallet += refundedAmount;
      user.purchaseValue-= refundedAmount;


      // Save the updated wallet balance back to the user's document
      await user.save();

      // Log the user's wallet balance after the refund
      console.log('User Wallet After Refund:', user.wallet);
    }

    // Delete the canceled order
    await Order.deleteOne({ _id: orderId });

    res.status(200).json({ success: true, message: 'Order canceled successfully' });
  } catch (error) {
    console.error('Error canceling order:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// ... (previous code)

app.get('/mywallet', requireAuth, async (req, res) => {
  try {
    // Retrieve the user's wallet balance from the database
    const userId = req.user;

    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).send('User not found');
    }

    // Pass the user's wallet balance to the template
    const walletBalance = user.wallet;

    // Render the "My Wallet" page and pass the walletBalance to the template
    res.render('mywallet', { walletBalance });
  } catch (error) {
    console.error('Error fetching wallet balance:', error);
    res.status(500).send('Internal server error');
  }
});

app.post('/add-money-to-wallet', requireAuth, async (req, res) => {
  try {
    const userId = req.user;
    const { amount } = req.body;

    // Validate the amount (e.g., check if it's a positive number)
    if (isNaN(amount) || amount <= 0) {
      return res.status(400).json({ success: false, error: 'Invalid amount' });
    }

    // Retrieve the user's current wallet balance from the database
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    // Update the user's wallet balance by adding the parsed amount
    user.wallet += parseFloat(amount);

    // Save the updated wallet balance back to the database
    await user.save();

    // Send a success response
    res.status(200).json({ success: true, message: 'Amount added to wallet successfully' });
  } catch (error) {
    console.error('Error adding money to wallet:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});
app.post('/withdraw-money-from-wallet', requireAuth, async (req, res) => {
  try {
    const userId = req.user;
    const { amount } = req.body;

    // Validate the withdrawal amount (e.g., check if it's a positive number)
    if (isNaN(amount) || amount <= 0) {
      return res.status(400).json({ success: false, error: 'Invalid amount' });
    }

    // Retrieve the user's current wallet balance from the database
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    // Check if the user has sufficient balance for withdrawal
    if (user.wallet < parseFloat(amount)) {
      return res.status(400).json({ success: false, error: 'Insufficient balance for withdrawal' });
    }

    // Update the user's wallet balance by subtracting the parsed amount
    user.wallet -= parseFloat(amount);

    // Save the updated wallet balance back to the database
    await user.save();

    // Send a success response
    res.status(200).json({ success: true, message: 'Amount withdrawn from wallet successfully' });
  } catch (error) {
    console.error('Error withdrawing money from wallet:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

app.get('/pastorders', requireAuth, async (req, res) => {
  try {
    // Fetch the user's orders with the status "Delivered" from the Order model based on their user ID
    const userId = req.user;
    const deliveredOrders = await Order.find({ id: userId, status: 'Delivered' }).sort({ date: -1 }); // Sort orders by date in descending order

    // Render the "Past Orders" page and pass the orders data to the template
    res.render('pastorders', { orders: deliveredOrders });
  } catch (error) {
    console.error('Error fetching delivered orders:', error);
    res.status(500).send('Internal server error');
  }
});

// RECOMMENDATION SYSTEM

const stringSimilarity = require('string-similarity');

// Sample inventory
//urad dal-> Black Gram; Toor Dal-> Pigeon Peas;Yogurt->curd
const inventory = [
  'Peas', 'Soy Sauce', 'Spring Onion', 'Corn Flour', 'Oil', 'Asafoetida (Hing)', 'Butter', 'Onion', 'Tomato',
  'Cauliflower', 'Red Chili Powder', 'Potato', 'Capsicum', 'Garlic', 'Ginger', 'Green Chilies', 'Carrot', 'Rice',
  'Wheat', 'Bread', 'Cucumber', 'Milk', 'Turmeric Powder', 'Coffee Powder', 'Tea Leaves', 'Sugar', 'Pav Bhaji Masala',
  'Cumin Powder', 'Paneer', 'Garam Masala', 'Chickpeas', 'Black Gram', 'Kidney Beans', 'Pigeon Peas', 'Coriander',
  'Curd', 'Cardamom', 'Gram Flour', 'All Purpose Flour', 'Baking Powder', 'Lemon', 'Mint', 'Salt','Cashew','Sesame Seeds','Clove',
  'Star Anise','Fennel Seeds','Sambar Powder','Bay Leaves','Mustard Seeds','Cumin Seeds','Dry Mango Powder','Curry Leaves','Egg','Cocoa Powder','Drumsticks','Red Chili Sauce','Cream',
  'Vanilla Extract','Sprouts','Okra','tamarind','Cabbage','Pumpkin','Brinjal','Apple','Banana','Mango','Strawberry','Pineapple','Kiwi','Custard Apple','Jamun','Musk Melon','Raspberry'
  ,'Pear','Papaya','Guava','Water Melon','Black/Green Grapes','Bell Pepper','Torai','Parval','Matki','Lobia','Masoor','Urad Dal','Toor Dal','Yogurt','Cinnamon','Pav','Besan Flour','Lady Finger','Coconut','Chana',
  'Mayonnaise','Beans','Saffron','Carrom Seeds','ajwain','Spinach','Black Pepper','Black Salt','Ghee','Noodles','Black Lentil','Chickpea Flour','Coffee Beans'
];
// Define an array to store the results
const results = [];
function findMatchingItem(modelItemName, inventory) {
  const matches = stringSimilarity.findBestMatch(modelItemName, inventory);
  
  const similarityThreshold = 0.6;
  console.log(inventory[matches.bestMatchIndex]," : ",matches.bestMatch.rating);

  if (matches.bestMatch.rating >= similarityThreshold) {
    return inventory[matches.bestMatchIndex];
  }

  return null;
}

app.post('/api/searchAI',requireAuth,async(req,res)=>{
  const {dish} = req.body;
  console.log(dish);
  try{

  
  const response = await openai.chat.completions.create({
    model: "gpt-3.5-turbo",
    messages: [{"role": "system", "content": "You are a helpful assistant.Return array only no other text or explanations."},
        {"role": "user", "content": `
        
    return extensive list of items used for making dish ${dish} as an array.Return only english name.Use specific name of spices.Use specific name of vegetables.Do not return water.Make sure that first letter is always capital.if nothing present in the list return empty object.Do not nest`},
        ],
  });
  

  // console.log(response.choices[0].message.content);
  const dishItems = response.choices[0].message.content;
  console.log("dishItems=>",dishItems);
  console.log(typeof(dishItems));
  const itemms = JSON.parse(dishItems);
  if(itemms.length >0){
    let finalmatch = [];
    itemms.forEach((item)=>{
      const UpperCaseItem = _.startCase(item);

      const matchingItem = findMatchingItem(UpperCaseItem, inventory);
      
      finalmatch.push(matchingItem);

      finalmatch = finalmatch.filter((item) => item !== null);


    });
    
    let ingredientnumber = 0;
    finalmatch.forEach((ingredient) => {
      if (ingredient === "Urad Dal") {
        finalmatch[ingredientnumber] = "Black Gram";
      } else if (ingredient === "Yogurt") {
        finalmatch[ingredientnumber]  = "Curd";
      } else if (ingredient === "Toor Dal"){
        finalmatch[ingredientnumber]  = "Pigeon Peas";
      } else if (ingredient === "Besan Flour"){
        finalmatch[ingredientnumber]  = "Gram Flour";
      } else if (ingredient === "Lady Finger"){
        finalmatch[ingredientnumber]  = "Okra";
      }else if (ingredient === "ajwain"){
        finalmatch[ingredientnumber]  = "Carrom Seeds";
      }else if (ingredient === "Black Lentil"){
        finalmatch[ingredientnumber]  = "Black Gram";
      }else if (ingredient === "Chickpea Flour"){
        finalmatch[ingredientnumber]  = "Gram Flour";
      }else if (ingredient === "Coffee Beans"){
        finalmatch[ingredientnumber]  = "Coffee Powder";
      }
      ingredientnumber=ingredientnumber+1;
      
    });

    console.log("You need : ");
    console.log(finalmatch);
    await finalmatch.forEach(async(item)=>{
      const existingCartItem = await Cart.findOne({ id: req.user, name: item });
      const price = await Product.findOne({name:item})
      

    if (existingCartItem) {
      // If the item is already in the cart, update the quantity and total price
      // existingCartItem.quantity += quantity;
      existingCartItem.quantity += 1;
      // existingCartItem.totalPrice += totalPrice;
      existingCartItem.totalPrice += price.price;
      await existingCartItem.save();
      //console.log("added item :",item,"to cart")
    } else {
      // If the item is not in the cart, create a new cart item
      
      const cartItem = new Cart({
        id: req.user,
        name: item,
        quantity:1,
        totalPrice:price.price,
      });
      await cartItem.save();
      //console.log("added item :",item,"to cart")
    }
    })
    

  }else{
    res.status(400).send('Invalid JSON response from GPT');
    
  }
  res.status(200).send('Items added to cart');
}
catch(error){
  console.error("Error:", error);
  res.status(500).send('Internal server error');
  
}
})
module.exports = Product;
app.use(authRoutes);
