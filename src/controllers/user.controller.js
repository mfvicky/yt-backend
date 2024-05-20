import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { User } from '../models/user.model.js';
import uploadCloudinary from '../utils/cloudinary.js';
import { ApiResponse } from "../utils/ApiResponse.js";
import jwt from "jsonwebtoken";

const generateAccessAndRefreshTokens = async (userId) => {
    try {
        const user = await User.findById(userId)
        const accessToken = user.generateAccessToken();
        const refreshToken = user.generateRefreshToken();

        user.refreshToken = refreshToken;
        await user.save({ validateBeforeSave: false });

        return { accessToken, refreshToken };
    } catch (error) {
        throw new ApiError(500, "Something went wrong while generating refresh token")
    }
}
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

        const { fullName, email, username, password } = req.body;
        console.log(req, res, req.body, email)

        if ([fullName, email, username, password].some((field) => field?.trim() === '')) {
            throw new ApiError(400, "All feild are required")
        }
        const existedUser = await User.findOne({
            $or: [{ username }, { email }]
        })
        if (existedUser) {
            throw new ApiError(409, "User with email or username already exists");
        }
        const avatarLocalPath = req.files?.avatar[0]?.path;
        // const coverImageLocalPath = req.files?.coverImage[0]?.path;
        let coverImageLocalPath;
        if (req.files && Array.isArray(req.files.coverImage) && req.files.coverImage.length > 0) {
            coverImageLocalPath = req.files?.coverImage[0]?.path;
        }

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

const loginUser = asyncHandler(async (req, res) => {
    // req data
    //username or email
    //user find
    // password check
    // access and refresh token gernate and send
    // send secure cookie to client

    const { email, username, password } = req.body;
    if (!username && !email) {
        throw new ApiError(400, "username or email is required")
    }

    const user = await User.findOne({ $or: [{ username }, { email }] })

    if (!user) {
        throw new ApiError(404, "User does not exist")
    }
    console.log(req.body, user, 'password->', password, 'email->', email);

    const isPasswordValid = await user.isPasswordCorrect(password)

    if (!isPasswordValid) {
        throw new ApiError(401, "Invalid user credentials")
    }

    const { accessToken, refreshToken } = await generateAccessAndRefreshTokens(user._id);

    const loggedInUser = await User.findById(user._id).select("-password -refreshToken");

    const options = {
        httpOnly: true,
        secure: true
    }
    return res
        .status(200)
        .cookie("accessToken", accessToken, options)
        .cookie("refreshToken", refreshToken, options)
        .json(new ApiResponse(
            200,
            {
                user: loggedInUser, accessToken, refreshToken
            },
            "User logged in successfully"
        ));
})

const logoutUser = asyncHandler(async (req, res) => {
    User.findByIdAndUpdate(
        req.user._id,
        {
            $set: {
                refreshToken: undefined
            }
        },
        {
            new: true
        }
    )

    const options = {
        httpOnly: true,
        secure: true
    }
    return res
        .status(200)
        .clearCookie("accessToken", options)
        .clearCookie("refreshToken", options)
        .json(new ApiResponse(200, {}, "user logged out succesfully"))
})

const refreshAccessToken = asyncHandler(async (req, res) => {
    const incomingRefreshToken = req.cookie.refreshToken || req.body.refreshToken;
    if (!incomingRefreshToken) {
        throw new ApiError(401, "unauthorized request");
    }
    try {
        const decodedToken = jwt.verify(incomingRefreshToken, process.env.ACCESS_TOKEN_SECRET);

        const user = await User.findById(decodedToken?._id)
        if (!user) {
            throw new ApiError(401, "invalid refresh token");
        }
        if (incomingRefreshToken !== user?.refreshToken) {
            throw new ApiError(401, "refresh token is expired or used");
        }
        const options = {
            httpOnly: true,
            secure: true,
        }
        const { accessToken, newRefreshToken } = await generateAccessAndRefreshTokens(user._id);
        return res
            .status(200)
            .cookie("accessToken", accessToken, options)
            .cookie("refreshToken", newRefreshToken, options)
            .json(new ApiResponse(
                200,
                {
                    accessToken, newRefreshToken
                },
                "access token refreshed"
            ));
    } catch (error) {
        throw new ApiError(401, error?.message || "invalid refresh token")
    }
})

const changeCurrentPassword = asyncHandler(async (req, res) => {
    const { oldPassword, newPassword } = req.body;
    const user = await findById(req.user?._id);
    const isPasswordCorrect = await user.isPasswordCorrect(oldPassword);
    if (!isPasswordCorrect) {
        throw new ApiError(400, "Invalid old password");
    }
    user.password = newPassword;
    await user.save({
        validateBeforeSave: false
    })

    return res
        .status(200)
        .json(new ApiResponse(200, {}, "password changed successfully"))
})

const getCurrentUser = asyncHandler(async (req, res) => {
    return res
        .status(200)
        .json(200, req.user, "current user fetched successfully")
})

const updateAccountDetails = asyncHandler(async (req, res) => {
    const { fullName, email } = req.body;
    if (!fullName || !email) {
        throw new ApiError(400, "All fields are required");
    }
    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set: {
                fullname: fullName,
                email
            }
        },
        { new: true }
    ).select("-password");

    return res
        .status(200)
        .json(new ApiResponse(200, user, "Account details updated successfully"))
})

const updateUserAvatar = asyncHandler(async (req, res) => {
    const avatarLocalPath = req.file?.path;
    if (!avatarLocalPath) {
        throw new ApiError(400, "Avatar file is missing");
    }

    const avatar = await uploadCloudinary(avatarLocalPath);
    if (!avatar.url) {
        throw new ApiError(400, "Error while uploading on avatar");
    }
    const user = await User
        .findByIdAndUpdate(
            req.user?._id,
            {
                $set: { avatar: avatar.url }
            },
            { new: true }
        )
        .select("-password")

    return res
        .status(200)
        .json(new ApiResponse(200, user, "cover images updated successfully"))
})

const updateUserCoverImage = asyncHandler(async (req, res) => {
    const coverImageLocalPath = req.file?.path;
    if (!coverImageLocalPath) {
        throw new ApiError(400, "Cover file is missing");
    }

    const coverImage = await uploadCloudinary(coverImageLocalPath);
    if (!coverImage.url) {
        throw new ApiError(400, "Error while uploading on Cover");
    }
    const user = await User
        .findByIdAndUpdate(
            req.user?._id,
            {
                $set: { coverImage: coverImage.url }
            },
            { new: true }
        )
        .select("-password")
    return res
        .status(200)
        .json(new ApiResponse(200, user, "cover images updated successfully"));
})
export {
    registerUser,
    loginUser,
    logoutUser,
    refreshAccessToken,
    changeCurrentPassword,
    getCurrentUser,
    updateAccountDetails,
    updateUserAvatar,
    updateUserCoverImage
}