import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { User } from '../models/user.model.js';
import uploadCloudinary from '../utils/cloudinary.js';
import { ApiResponse } from "../utils/ApiResponse.js";
const registerUser = asyncHandler(
    async (req, res) => {
        // res.status(200).json({
        //     message: 'user registed'
        // })

        // get usre detail
        // validation
        // check if users already exists: username and email
        // check for images, check for avatar 
        // upload them to cloudinary, avatar
        // create user object- create entry in db
        // remove password and refrsh token field from response
        // check for user creation
        // return response

        const { fullName, email, username, pasword } = req.body;
        console.log(req.body, email)

        if ([fullName, email, username, pasword].some((field) => field?.trim() === '')) {
            throw new ApiError(400, "All feild are required")
        }
        const existedUser = User.findOne({
            $or: [{ username }, { email }]
        })
        if (existedUser) {
            throw new ApiError(409, "User with email or username already exists");
        }
        const avatarLocalPath = req.files?.avatar[0]?.path;
        const coverImageLocalPath = req.files?.coverImage[0]?.path;

        if (!avatarLocalPath) {
            throw new ApiError(400, "Avatar file is required");
        }

        const avatar = await uploadCloudinary(avatarLocalPath);
        const coverImage = await uploadCloudinary(coverImageLocalPath);

        if (!avatar) {
            throw new ApiError(400, "Avatar file is required")
        }

        const user = await User.create({
            fullname: fullName,
            avatar: avatar.url,
            coverImage: coverImage?.url || '',//coverimage is not compulsory
            email,
            password,
            username: username.toLowerCase(),

        })

        const createdUser = await User.findById(user._id).select(
            "-password -refreshToken"
        )

        if (!createdUser) {
            throw new ApiError(500, "Something went wrong while registering the user")
        }

        return res.status(201).json(
            new ApiResponse(200, createdUser, "User registered successfully ")
        )
    }
)

export { registerUser }